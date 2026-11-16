import type { DatabaseSync } from "./sqlite";
import type { Role } from "@apex/schema";
import { roleOf } from "./mapping";
import type { RiotMatch } from "./riot";
import type { PlayerTimeline } from "./timeline";

export interface Filter { patch?: string; brackets?: string[]; platform?: string }
export interface Row { name: string; games: number; wins: number }
const RANKED_SOLO = 420, MIN_SECONDS = 300; // remakes and early surrenders are ignored

/** The whole rune page of one player as JSON: styles, the 4 + 2 selected runes and the 3 stat shards. null when Riot sent no (or an incomplete) page. */
export function perksJson(p: RiotMatch["info"]["participants"][number]): string | null {
  const [a, b] = p.perks?.styles ?? [], sp = p.perks?.statPerks;
  if (!a || !b || a.style == null || b.style == null || a.selections.length !== 4 || b.selections.length !== 2 || !sp) return null;
  return JSON.stringify({ p: a.style, s: b.style, r: [...a.selections, ...b.selections].map((x) => x.perk), h: [sp.offense, sp.flex, sp.defense] });
}

/** Normalised match data (plan section 5.5), one SQLite file. Aggregates are computed with SQL on demand. */
export function makeStore(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, patch TEXT NOT NULL, bracket TEXT, platform TEXT, ended_at INTEGER NOT NULL, duration INTEGER NOT NULL, blue_win INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS participants (match_id TEXT NOT NULL, puuid TEXT, team INTEGER NOT NULL, champion TEXT NOT NULL, role TEXT, win INTEGER NOT NULL, keystone INTEGER,
      items TEXT NOT NULL, spell1 INTEGER, spell2 INTEGER, kills INTEGER, deaths INTEGER, assists INTEGER, cs INTEGER, damage INTEGER, gold INTEGER);
    CREATE INDEX IF NOT EXISTS p_champ ON participants(champion); CREATE INDEX IF NOT EXISTS p_match ON participants(match_id);
    CREATE TABLE IF NOT EXISTS bans (match_id TEXT NOT NULL, champion_key INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS seeds (puuid TEXT PRIMARY KEY, tier TEXT NOT NULL, platform TEXT, crawled_at INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ladder_runs (platform TEXT NOT NULL, tier TEXT NOT NULL, division TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (platform, tier, division));`);
  // Databases created by earlier versions lack the platform columns.
  for (const t of ["matches", "seeds"]) if (!(db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some((c) => c.name === "platform")) db.exec(`ALTER TABLE ${t} ADD COLUMN platform TEXT`);
  // Databases created by earlier versions lack these columns (full rune page, and the timeline data: skill order, starting items, purchases). Old rows stay NULL and are ignored by those stats.
  const pcols = (db.prepare("PRAGMA table_info(participants)").all() as { name: string }[]).map((c) => c.name);
  for (const c of ["perks", "skills", "start", "buys"]) if (!pcols.includes(c)) db.exec(`ALTER TABLE participants ADD COLUMN ${c} TEXT`);
  const q = <T,>(sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args) as T[];
  const filt = (f: Filter) => { const c: string[] = [], a: string[] = []; if (f.patch) { c.push("m.patch = ?"); a.push(f.patch); } if (f.platform) { c.push("m.platform = ?"); a.push(f.platform); } if (f.brackets?.length) { c.push(`m.bracket IN (${f.brackets.map(() => "?").join(",")})`); a.push(...f.brackets); } return { sql: c.map((x) => ` AND ${x}`).join(""), args: a }; };
  const insM = db.prepare("INSERT OR IGNORE INTO matches (id, patch, bracket, platform, ended_at, duration, blue_win) VALUES (?,?,?,?,?,?,?)"), insP = db.prepare("INSERT INTO participants (match_id, puuid, team, champion, role, win, keystone, items, spell1, spell2, kills, deaths, assists, cs, damage, gold, perks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"), insB = db.prepare("INSERT INTO bans VALUES (?,?)");

  return {
    /** Adds timeline data to the already stored players of a match (matched by puuid). Returns how many players were updated. */
    saveTimeline(matchId: string, players: Map<string, PlayerTimeline>): number {
      const up = db.prepare("UPDATE participants SET skills = ?, start = ?, buys = ? WHERE match_id = ? AND puuid = ?"); let n = 0;
      db.exec("BEGIN");
      try { for (const [puuid, t] of players) n += Number(up.run(JSON.stringify(t.skills), JSON.stringify(t.start), JSON.stringify(t.buys), matchId, puuid).changes); db.exec("COMMIT"); }
      catch (e) { db.exec("ROLLBACK"); throw e; }
      return n;
    },
    hasMatch: (id: string) => !!db.prepare("SELECT 1 FROM matches WHERE id = ?").get(id),
    /** Returns true if the match was stored. Only Ranked Solo games longer than 5 minutes count. */
    saveMatch(m: RiotMatch, bracket: string, platform: string): boolean {
      const i = m.info;
      if (i.queueId !== RANKED_SOLO || i.gameDuration < MIN_SECONDS || this.hasMatch(m.metadata.matchId)) return false;
      const id = m.metadata.matchId, patch = (i.gameVersion ?? "unknown").split(".").slice(0, 2).join(".");
      db.exec("BEGIN");
      try {
        insM.run(id, patch, bracket, platform, i.gameEndTimestamp ?? i.gameCreation + i.gameDuration * 1000, i.gameDuration, i.participants.find((p) => p.teamId === 100)?.win ? 1 : 0);
        for (const p of i.participants) {
          const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter((x): x is number => !!x && x > 0);
          insP.run(id, p.puuid, p.teamId, p.championName, roleOf(p.teamPosition || p.individualPosition), p.win ? 1 : 0, p.perks?.styles?.[0]?.selections?.[0]?.perk ?? null, JSON.stringify(items),
            p.summoner1Id ?? null, p.summoner2Id ?? null, p.kills, p.deaths, p.assists, p.totalMinionsKilled + p.neutralMinionsKilled, p.totalDamageDealtToChampions, p.goldEarned, perksJson(p));
        }
        for (const t of i.teams ?? []) for (const b of t.bans) if (b.championId > 0) insB.run(id, b.championId);
        db.exec("COMMIT"); return true;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    addSeeds(puuids: string[], tier: string, platform: string) { const s = db.prepare("INSERT OR IGNORE INTO seeds (puuid, tier, platform) VALUES (?, ?, ?)"); for (const p of puuids) s.run(p, tier, platform); },
    seedCount: () => (db.prepare("SELECT COUNT(*) n FROM seeds").get() as { n: number }).n,
    /** True if this ladder (region, tier and division) was read since `since`. */
    isSeeded(platform: string, tier: string, division: string, since = 0) {
      const r = db.prepare("SELECT at FROM ladder_runs WHERE platform = ? AND tier = ? AND division = ?").get(platform, tier, division) as { at: number } | undefined;
      return !!r && r.at >= since;
    },
    /** Remembered separately from the players, because the same player can appear in more than one ladder. */
    markSeeded: (platform: string, tier: string, division: string, at: number) => void db.prepare("INSERT OR REPLACE INTO ladder_runs (platform, tier, division, at) VALUES (?, ?, ?, ?)").run(platform, tier, division, at),
    /**
     * Takes the least recently crawled player and marks them crawled in the same step, so parallel workers never get the same one.
     * Ties (every new player) are broken randomly. `platforms` restricts the choice (the collector uses it to balance the regional clusters).
     */
    claimSeed(olderThan: number, now: number, platforms?: string[]) {
      const only = platforms?.length ? ` AND platform IN (${platforms.map(() => "?").join(",")})` : "";
      const row = db.prepare(`SELECT puuid, platform, tier FROM seeds WHERE crawled_at < ? AND platform IS NOT NULL${only} ORDER BY crawled_at, RANDOM() LIMIT 1`).get(olderThan, ...(platforms ?? [])) as { puuid: string; platform: string; tier: string } | undefined;
      if (row) db.prepare("UPDATE seeds SET crawled_at = ? WHERE puuid = ?").run(now, row.puuid);
      return row;
    },
    /** Rows written before platforms were tracked belong to the platform the collector was configured for. */
    backfillPlatform(platform: string) { db.prepare("UPDATE matches SET platform = ? WHERE platform IS NULL").run(platform); db.prepare("UPDATE seeds SET platform = ? WHERE platform IS NULL").run(platform); },
    /** What the collected data contains, for the filter menus. */
    facets() {
      const g = (col: string) => q<{ id: string; matches: number }>(`SELECT ${col} id, COUNT(*) matches FROM matches WHERE ${col} IS NOT NULL GROUP BY ${col} ORDER BY matches DESC`);
      return { platforms: g("platform"), ranks: g("bracket"), patches: q<{ id: string; matches: number }>("SELECT patch id, COUNT(*) matches FROM matches GROUP BY patch ORDER BY MAX(ended_at) DESC") };
    },
    /** Everything the draft engine needs, as compact arrays. Pairs with fewer than `min` games are left out. */
    draftStats(f: Filter, min = 3) {
      const w = filt(f);
      const champions = this.championRows(f), per = new Map<string, { games: number; wins: number; roles: Map<string, number> }>();
      for (const r of champions) { const e = per.get(r.champion) ?? { games: 0, wins: 0, roles: new Map() }; e.games += r.games; e.wins += r.wins; if (r.role) e.roles.set(r.role, r.games); per.set(r.champion, e); }
      const pairs = (sameTeam: boolean) => q<[string, string, number, number]>(`SELECT a.champion x, b.champion y, COUNT(*) g, SUM(a.win) w FROM participants a JOIN participants b ON a.match_id = b.match_id AND a.champion < b.champion
        AND ${sameTeam ? "a.team = b.team" : "a.team <> b.team AND a.role IS NOT NULL AND a.role = b.role"} JOIN matches m ON m.id = a.match_id WHERE 1=1${w.sql} GROUP BY a.champion, b.champion HAVING g >= ${min}`, ...w.args)
        .map((r) => { const o = r as unknown as { x: string; y: string; g: number; w: number }; return [o.x, o.y, o.g, o.w] as [string, string, number, number]; });
      return { games: this.matchCount(f), champions: [...per].map(([id, e]) => ({ id, games: e.games, wins: e.wins, roles: [...e.roles].filter(([, g]) => g >= Math.max(2, e.games * 0.1)).map(([r]) => r) })), matchups: pairs(false), synergies: pairs(true) };
    },
    markCrawled: (puuid: string, at: number) => void db.prepare("UPDATE seeds SET crawled_at = ? WHERE puuid = ?").run(at, puuid),
    counts: () => ({ matches: (db.prepare("SELECT COUNT(*) n FROM matches").get() as { n: number }).n, seeds: (db.prepare("SELECT COUNT(*) n FROM seeds").get() as { n: number }).n,
      crawled: (db.prepare("SELECT COUNT(*) n FROM seeds WHERE crawled_at > 0").get() as { n: number }).n }),
    latestPatch: () => (db.prepare("SELECT patch FROM matches ORDER BY ended_at DESC LIMIT 1").get() as { patch: string } | undefined)?.patch,
    matchCount: (f: Filter) => { const w = filt(f); return (db.prepare(`SELECT COUNT(*) n FROM matches m WHERE 1=1${w.sql}`).get(...w.args) as { n: number }).n; },
    championRows(f: Filter, role?: Role) { const w = filt(f); return q<{ champion: string; role: string | null; games: number; wins: number }>(
      `SELECT p.champion, p.role, COUNT(*) games, SUM(p.win) wins FROM participants p JOIN matches m ON m.id = p.match_id WHERE 1=1${w.sql}${role ? " AND p.role = ?" : ""} GROUP BY p.champion, p.role`, ...w.args, ...(role ? [role] : [])); },
    /**
     * Average per-game performance of comparable collected games (same role, optionally same champion and rank bracket).
     * kda = (kills + assists) / max(deaths, 1) per game, the rest are per minute. Games without stored stats are ignored.
     */
    averages(a: { role: string; champion?: string; bracket?: string }): { games: number; kda: number; cs: number; damage: number; gold: number } {
      const cond = ["p.role = ?", "p.kills IS NOT NULL", "m.duration >= 300"], args: (string | number)[] = [a.role];
      if (a.champion) { cond.push("p.champion = ?"); args.push(a.champion); }
      if (a.bracket) { cond.push("m.bracket = ?"); args.push(a.bracket); }
      const r = db.prepare(`SELECT COUNT(*) games, AVG((p.kills + p.assists) * 1.0 / MAX(p.deaths, 1)) kda, AVG(p.cs * 60.0 / m.duration) cs, AVG(p.damage * 60.0 / m.duration) damage, AVG(p.gold * 60.0 / m.duration) gold
        FROM participants p JOIN matches m ON m.id = p.match_id WHERE ${cond.join(" AND ")}`).get(...args) as { games: number; kda: number | null; cs: number | null; damage: number | null; gold: number | null };
      return { games: r.games, kda: r.kda ?? 0, cs: r.cs ?? 0, damage: r.damage ?? 0, gold: r.gold ?? 0 };
    },
    /** One row per collected game of this champion (optionally in one role): its rune page, spells and final items. Input for computeBuild. */
    buildRows(champion: string, f: Filter, role?: Role): { perks: string | null; items: string; spell1: number | null; spell2: number | null; win: number; skills: string | null; start: string | null; buys: string | null }[] {
      const w = filt(f);
      return q(`SELECT p.perks, p.items, p.spell1, p.spell2, p.win, p.skills, p.start, p.buys FROM participants p JOIN matches m ON m.id = p.match_id WHERE p.champion = ?${role ? " AND p.role = ?" : ""}${w.sql}`, champion, ...(role ? [role] : []), ...w.args);
    },
    bans(f: Filter) { const w = filt(f); return q<{ k: number; n: number }>(`SELECT b.champion_key k, COUNT(*) n FROM bans b JOIN matches m ON m.id = b.match_id WHERE 1=1${w.sql} GROUP BY k`, ...w.args); },
    /** Lane matchups: same role, opposite team. */
    matchups(champion: string, f: Filter): Row[] { const w = filt(f); return q<Row>(`SELECT b.champion name, COUNT(*) games, SUM(a.win) wins FROM participants a JOIN participants b ON a.match_id = b.match_id AND a.team <> b.team AND a.role IS NOT NULL AND a.role = b.role
      JOIN matches m ON m.id = a.match_id WHERE a.champion = ?${w.sql} GROUP BY b.champion ORDER BY games DESC`, champion, ...w.args); },
    keystones(champion: string, f: Filter): { id: number; games: number; wins: number }[] { const w = filt(f); return q(`SELECT p.keystone id, COUNT(*) games, SUM(p.win) wins FROM participants p JOIN matches m ON m.id = p.match_id
      WHERE p.champion = ? AND p.keystone IS NOT NULL${w.sql} GROUP BY p.keystone ORDER BY games DESC LIMIT 6`, champion, ...w.args); },
    items(champion: string, f: Filter): { id: number; games: number; wins: number }[] { const w = filt(f); return q(`SELECT CAST(j.value AS INTEGER) id, COUNT(*) games, SUM(p.win) wins FROM participants p JOIN matches m ON m.id = p.match_id, json_each(p.items) j
      WHERE p.champion = ?${w.sql} GROUP BY j.value ORDER BY games DESC LIMIT 40`, champion, ...w.args); },
  };
}
export type Store = ReturnType<typeof makeStore>;

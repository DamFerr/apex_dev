import { extraItems } from "./participantItems";
import type { DatabaseSync } from "./sqlite";
import { publicPatch, type Role } from "@apex/schema";
import { roleOf } from "./mapping";
import { canonicalChampionId, RIOT_CHAMPION_ALIASES } from "./champions";
import type { RiotMatch } from "./riot";
import { timelineBucket, type PlayerTimeline } from "./timeline";

/** `patches` undefined = no patch restriction (only used below the API; the API always passes a list); an empty list matches nothing. */
export interface Filter { patches?: string[]; brackets?: string[]; platform?: string }
export interface Row { name: string; games: number; wins: number }
/** A champion met in some role, with the games and wins of the champion it was asked about. */
export interface Rel { champion: string; role: string; games: number; wins: number }
const RANKED_SOLO = 420, MIN_SECONDS = 300; // remakes and early surrenders are ignored

/** Apex keeps data for the newest KEEP_PATCHES patches only (the newest one seen in the collected games, never decided by the clock). */
export const KEEP_PATCHES = 5;
const PATCH_RE = /^(\d+)\.(\d+)$/;
/** "26.22" style patch (major.minor). Anything else, like the "unknown" of a match without a version, is not a patch. */
export const isPatch = (p: string) => PATCH_RE.test(p);
/** Numeric comparison, negative when `a` is older than `b`: 26.9 is older than 26.10 (a string sort gets this wrong). */
export function comparePatch(a: string, b: string): number {
  const [a1, a2] = a.split(".").map(Number), [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
}
/** The valid, distinct patches among `patches`, newest first. The one place that defines patch order. */
export const patchOrder = (patches: string[]): string[] => [...new Set(patches.filter(isPatch))].sort((a, b) => comparePatch(b, a));
/** The newest `n` patches among `patches`, newest first. */
export const lastPatches = (patches: string[], n = KEEP_PATCHES): string[] => patchOrder(patches).slice(0, n);

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
    CREATE INDEX IF NOT EXISTS p_champ ON participants(champion); CREATE INDEX IF NOT EXISTS p_match ON participants(match_id); CREATE INDEX IF NOT EXISTS m_patch ON matches(patch);
    CREATE TABLE IF NOT EXISTS bans (match_id TEXT NOT NULL, champion_key INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS seeds (puuid TEXT PRIMARY KEY, tier TEXT NOT NULL, platform TEXT, crawled_at INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS rank_snapshots (puuid TEXT NOT NULL, at INTEGER NOT NULL, tier TEXT NOT NULL, division TEXT NOT NULL, lp INTEGER NOT NULL, wins INTEGER NOT NULL, losses INTEGER NOT NULL, PRIMARY KEY (puuid, at));
    CREATE TABLE IF NOT EXISTS ladder_runs (platform TEXT NOT NULL, tier TEXT NOT NULL, division TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (platform, tier, division));`);
  // Games stored with the game's internal version (16.22) get Riot's public patch number (26.22); see publicPatch. Safe to repeat.
  db.exec("UPDATE matches SET patch = (CAST(substr(patch, 1, instr(patch, '.') - 1) AS INTEGER) + 10) || substr(patch, instr(patch, '.')) WHERE patch GLOB '1[0-9].*'");
  // Databases created by earlier versions lack the crawl depth (which slice of a player's history is read next, 0 = the newest games).
  if (!(db.prepare("PRAGMA table_info(seeds)").all() as { name: string }[]).some((c) => c.name === "depth")) db.exec("ALTER TABLE seeds ADD COLUMN depth INTEGER NOT NULL DEFAULT 0");
  // Databases created by earlier versions lack the platform columns.
  for (const t of ["matches", "seeds"]) if (!(db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some((c) => c.name === "platform")) db.exec(`ALTER TABLE ${t} ADD COLUMN platform TEXT`);
  // Databases created by earlier versions lack these columns (full rune page, and the timeline data: skill order, starting items, purchases). Old rows stay NULL and are ignored by those stats.
  const pcols = (db.prepare("PRAGMA table_info(participants)").all() as { name: string }[]).map((c) => c.name);
  for (const c of ["perks", "skills", "start", "buys"]) if (!pcols.includes(c)) db.exec(`ALTER TABLE participants ADD COLUMN ${c} TEXT`);
  // Damage by type, damage taken and CC time (team composition analysis). Older games have NULL here and are skipped by compProfiles.
  for (const c of ["dmg_p", "dmg_m", "dmg_t", "taken", "cc"]) if (!pcols.includes(c)) db.exec(`ALTER TABLE participants ADD COLUMN ${c} INTEGER`);
  // Timeline backfill bookkeeping: `tl_bucket` (0..999, decides membership in the timeline share), `tl_state` (NULL = not fetched yet, 1 = stored, 2 = Riot has no timeline for it, never retried).
  const mcols = (db.prepare("PRAGMA table_info(matches)").all() as { name: string }[]).map((c) => c.name);
  if (!mcols.includes("tl_bucket")) {
    db.exec("ALTER TABLE matches ADD COLUMN tl_bucket INTEGER; ALTER TABLE matches ADD COLUMN tl_state INTEGER");
    // One-time fill for games stored by earlier versions: their bucket, and "stored" for those that already have timeline data.
    const setBucket = db.prepare("UPDATE matches SET tl_bucket = ? WHERE id = ?");
    db.exec("BEGIN");
    try {
      for (const r of db.prepare("SELECT id FROM matches").all() as { id: string }[]) setBucket.run(timelineBucket(r.id), r.id);
      db.exec("UPDATE matches SET tl_state = 1 WHERE id IN (SELECT DISTINCT match_id FROM participants WHERE skills IS NOT NULL)");
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
  db.exec("CREATE INDEX IF NOT EXISTS m_tl ON matches(tl_state, ended_at)");
  // Games stored before champion ids were canonicalised (e.g. "FiddleSticks") are renamed to the Data Dragon spelling, so one champion is never split in two. Safe to repeat.
  for (const [riot, dd] of Object.entries(RIOT_CHAMPION_ALIASES)) db.prepare("UPDATE participants SET champion = ? WHERE champion = ?").run(dd, riot);
  const q = <T,>(sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args) as T[];
  const filt = (f: Filter) => { const c: string[] = [], a: string[] = []; if (f.patches) { if (f.patches.length) { c.push(`m.patch IN (${f.patches.map(() => "?").join(",")})`); a.push(...f.patches); } else c.push("1 = 0"); } if (f.platform) { c.push("m.platform = ?"); a.push(f.platform); } if (f.brackets?.length) { c.push(`m.bracket IN (${f.brackets.map(() => "?").join(",")})`); a.push(...f.brackets); } return { sql: c.map((x) => ` AND ${x}`).join(""), args: a }; };
  const insM = db.prepare("INSERT OR IGNORE INTO matches (id, patch, bracket, platform, ended_at, duration, blue_win, tl_bucket) VALUES (?,?,?,?,?,?,?,?)"), insP = db.prepare("INSERT INTO participants (match_id, puuid, team, champion, role, win, keystone, items, spell1, spell2, kills, deaths, assists, cs, damage, gold, perks, dmg_p, dmg_m, dmg_t, taken, cc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"), insB = db.prepare("INSERT INTO bans VALUES (?,?)");

  // The distinct patches in the database, read once and kept up to date by saveMatch and pruneOldPatches (this process is the only writer).
  let known: Set<string> | undefined;
  const knownPatches = () => (known ??= new Set((db.prepare("SELECT DISTINCT patch FROM matches").all() as { patch: string }[]).map((r) => r.patch)));

  return {
    /** The newest `n` patches that have collected games, newest first. These are the only patches Apex keeps and shows. */
    recentPatches: (n = KEEP_PATCHES): string[] => lastPatches([...knownPatches()], n),
    /**
     * Deletes every game (with its players and bans) whose patch is not one of the newest `keep`. Rank snapshots (LP history) and the
     * player seeds are not patch data and stay. Does nothing when no valid patch is stored. Returns what was removed.
     */
    pruneOldPatches(keep = KEEP_PATCHES): { kept: string[]; removedMatches: number } {
      const kept = lastPatches([...knownPatches()], keep);
      if (!kept.length) return { kept, removedMatches: 0 };
      const ph = kept.map(() => "?").join(","), old = `SELECT id FROM matches WHERE patch NOT IN (${ph})`;
      let removedMatches = 0;
      db.exec("BEGIN");
      try {
        db.prepare(`DELETE FROM participants WHERE match_id IN (${old})`).run(...kept); // children first, while the matches still tell which ones are old
        db.prepare(`DELETE FROM bans WHERE match_id IN (${old})`).run(...kept);
        removedMatches = Number(db.prepare(`DELETE FROM matches WHERE patch NOT IN (${ph})`).run(...kept).changes);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
      known = new Set(kept);
      return { kept, removedMatches };
    },
    /**
     * Gives the space of deleted games back to the disk (SQLite only reuses it otherwise, so the file never shrinks after a cleanup).
     * VACUUM rewrites the whole file and needs free disk space about the size of the database, so call it only after a big cleanup and
     * never while the collector writes (server start, before the collector runs). Returns false (and changes nothing) if it cannot run.
     */
    compact(): boolean {
      try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); db.exec("VACUUM"); return true; } catch { return false; }
    },
    /**
     * Remembers a player's Ranked Solo rank (LP history). A snapshot identical to the latest one is not stored again, so the history only
     * grows when the rank, LP or win/loss counters changed. Returns true when a row was added.
     */
    saveRankSnapshot(puuid: string, r: { tier: string; division: string; lp: number; wins: number; losses: number }, at: number): boolean {
      const last = db.prepare("SELECT at, tier, division, lp, wins, losses FROM rank_snapshots WHERE puuid = ? ORDER BY at DESC LIMIT 1").get(puuid) as { at: number; tier: string; division: string; lp: number; wins: number; losses: number } | undefined;
      if (last && last.at >= at) return false; // never write out of order
      if (last && last.tier === r.tier && last.division === r.division && last.lp === r.lp && last.wins === r.wins && last.losses === r.losses) return false;
      db.prepare("INSERT OR IGNORE INTO rank_snapshots (puuid, at, tier, division, lp, wins, losses) VALUES (?,?,?,?,?,?,?)").run(puuid, at, r.tier, r.division, r.lp, r.wins, r.losses);
      return true;
    },
    /** The most recent `limit` snapshots of a player, oldest first. */
    rankHistory(puuid: string, limit = 500): { at: number; tier: string; division: string; lp: number; wins: number; losses: number }[] {
      return (db.prepare("SELECT at, tier, division, lp, wins, losses FROM (SELECT * FROM rank_snapshots WHERE puuid = ? ORDER BY at DESC LIMIT ?) ORDER BY at ASC").all(puuid, limit)) as never;
    },
    /** Adds timeline data to the already stored players of a match (matched by puuid). Returns how many players were updated. */
    saveTimeline(matchId: string, players: Map<string, PlayerTimeline>): number {
      const up = db.prepare("UPDATE participants SET skills = ?, start = ?, buys = ? WHERE match_id = ? AND puuid = ?"); let n = 0;
      db.exec("BEGIN");
      try { for (const [puuid, t] of players) n += Number(up.run(JSON.stringify(t.skills), JSON.stringify(t.start), JSON.stringify(t.buys), matchId, puuid).changes); db.prepare("UPDATE matches SET tl_state = 1 WHERE id = ?").run(matchId); db.exec("COMMIT"); }
      catch (e) { db.exec("ROLLBACK"); throw e; }
      return n;
    },
    /** Riot has no timeline for this game (it is gone from their servers): remember it so the backfill never asks again. */
    markTimelineUnavailable: (matchId: string) => void db.prepare("UPDATE matches SET tl_state = 2 WHERE id = ?").run(matchId),
    /**
     * Stored games inside the timeline share (`share` 0..1) whose timeline was never fetched, newest first (the newest patch matters most),
     * on the given platforms. The backfill works through these.
     */
    pendingTimelines(share: number, platforms: string[], limit: number): { id: string; platform: string }[] {
      if (!platforms.length || share <= 0 || limit <= 0) return [];
      return q<{ id: string; platform: string }>(`SELECT id, platform FROM matches WHERE tl_state IS NULL AND tl_bucket < ? AND platform IN (${platforms.map(() => "?").join(",")}) ORDER BY ended_at DESC LIMIT ?`, Math.ceil(share * 1000), ...platforms, Math.floor(limit));
    },
    /** How many stored games still wait for a timeline inside the share. */
    timelineBacklog: (share: number) => (db.prepare("SELECT COUNT(*) n FROM matches WHERE tl_state IS NULL AND tl_bucket < ?").get(Math.ceil(Math.max(0, share) * 1000)) as { n: number }).n,
    hasMatch: (id: string) => !!db.prepare("SELECT 1 FROM matches WHERE id = ?").get(id),
    /**
     * Returns true if the match was stored. Only Ranked Solo games longer than 5 minutes count, and only on one of the newest
     * KEEP_PATCHES patches: a game from an older (or unreadable) patch is refused. The first game of a new patch also removes the data of
     * the patch that falls out of the window.
     */
    saveMatch(m: RiotMatch, bracket: string, platform: string): boolean {
      const i = m.info;
      if (i.queueId !== RANKED_SOLO || i.gameDuration < MIN_SECONDS || this.hasMatch(m.metadata.matchId)) return false;
      const id = m.metadata.matchId, patch = publicPatch(i.gameVersion ?? "unknown"), seen = knownPatches();
      if (!lastPatches([...seen, patch]).includes(patch)) return false;
      db.exec("BEGIN");
      try {
        insM.run(id, patch, bracket, platform, i.gameEndTimestamp ?? i.gameCreation + i.gameDuration * 1000, i.gameDuration, i.participants.find((p) => p.teamId === 100)?.win ? 1 : 0, timelineBucket(id));
        for (const p of i.participants) {
          const items = [...new Set([p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6, ...extraItems(p)].filter((x): x is number => !!x && x > 0))];   // + the role quest slot (ADC boots)
          insP.run(id, p.puuid, p.teamId, canonicalChampionId(p.championName), roleOf(p.teamPosition || p.individualPosition), p.win ? 1 : 0, p.perks?.styles?.[0]?.selections?.[0]?.perk ?? null, JSON.stringify(items),
            p.summoner1Id ?? null, p.summoner2Id ?? null, p.kills, p.deaths, p.assists, p.totalMinionsKilled + p.neutralMinionsKilled, p.totalDamageDealtToChampions, p.goldEarned, perksJson(p),
            p.physicalDamageDealtToChampions ?? null, p.magicDamageDealtToChampions ?? null, p.trueDamageDealtToChampions ?? null, p.totalDamageTaken ?? null, p.timeCCingOthers ?? null);
        }
        for (const t of i.teams ?? []) for (const b of t.bans) if (b.championId > 0) insB.run(id, b.championId);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
      if (!seen.has(patch)) { seen.add(patch); this.pruneOldPatches(); } // a new patch: the oldest one leaves the window
      return true;
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
      // Shallow slices first: every player's newest games (the latest patch) are read before anyone's older ones. A player with depth > 0 is mid-history and due at once.
      const row = db.prepare(`SELECT puuid, platform, tier, depth FROM seeds WHERE (crawled_at < ? OR depth > 0) AND platform IS NOT NULL${only} ORDER BY depth, crawled_at, RANDOM() LIMIT 1`).get(olderThan, ...(platforms ?? [])) as { puuid: string; platform: string; tier: string; depth: number } | undefined;
      if (row) db.prepare("UPDATE seeds SET crawled_at = ? WHERE puuid = ?").run(now, row.puuid);
      return row;
    },
    /** Rows written before platforms were tracked belong to the platform the collector was configured for. */
    backfillPlatform(platform: string) { db.prepare("UPDATE matches SET platform = ? WHERE platform IS NULL").run(platform); db.prepare("UPDATE seeds SET platform = ? WHERE platform IS NULL").run(platform); },
    /**
     * What the collected data contains, for the filter menus. Each menu counts the games that pass the OTHER two active filters in `f`
     * (the regions under the chosen patch and rank, and so on) and ignores its own, so every option shows what choosing it would give.
     * No filter = everything. Ranks come back per tier; the caller makes them cumulative.
     */
    facets(f: Filter = {}) {
      const g = (col: string, w: Filter) => { const x = filt(w); return q<{ id: string; matches: number }>(`SELECT m.${col} id, COUNT(*) matches FROM matches m WHERE m.${col} IS NOT NULL${x.sql} GROUP BY m.${col} ORDER BY matches DESC`, ...x.args); };
      const per = new Map(g("patch", { platform: f.platform, brackets: f.brackets }).map((r) => [r.id, r.matches]));
      return { platforms: g("platform", { patches: f.patches, brackets: f.brackets }), ranks: g("bracket", { patches: f.patches, platform: f.platform }),
        patches: this.recentPatches().map((id) => ({ id, matches: per.get(id) ?? 0 })) }; // the kept patches, newest first (numerically)
    },
    /**
     * Per champion sums for the team composition analysis: damage to champions by type, damage taken, CC time and the seconds played,
     * over games that have the new columns (older stored games are skipped, so `games` is the measured sample, not all games).
     */
    compProfiles(f: Filter) {
      const w = filt(f);
      return q<{ id: string; role: string | null; games: number; phys: number; magic: number; trueDmg: number; taken: number; cc: number; seconds: number }>(
        `SELECT p.champion id, p.role role, COUNT(*) games, SUM(p.dmg_p) phys, SUM(p.dmg_m) magic, SUM(p.dmg_t) trueDmg, SUM(COALESCE(p.taken, 0)) taken, SUM(COALESCE(p.cc, 0)) cc, SUM(m.duration) seconds
         FROM participants p JOIN matches m ON m.id = p.match_id WHERE p.dmg_p IS NOT NULL AND p.dmg_m IS NOT NULL AND p.dmg_t IS NOT NULL${w.sql} GROUP BY p.champion, p.role`, ...w.args);
    },
    /** Everything the draft engine needs, as compact arrays. Pairs with fewer than `min` games are left out. */
    draftStats(f: Filter, min = 3) {
      const w = filt(f);
      const champions = this.championRows(f), per = new Map<string, { games: number; wins: number; roles: Map<string, number> }>();
      for (const r of champions) { const e = per.get(r.champion) ?? { games: 0, wins: 0, roles: new Map() }; e.games += r.games; e.wins += r.wins; if (r.role) e.roles.set(r.role, r.games); per.set(r.champion, e); }
      const pairs = (sameTeam: boolean) => q<[string, string, number, number]>(`SELECT a.champion x, b.champion y, COUNT(*) g, SUM(a.win) w FROM participants a JOIN participants b ON a.match_id = b.match_id AND a.champion < b.champion
        AND ${sameTeam ? "a.team = b.team" : "a.team <> b.team AND a.role IS NOT NULL AND a.role = b.role"} JOIN matches m ON m.id = a.match_id WHERE 1=1${w.sql} GROUP BY a.champion, b.champion HAVING g >= ${min}`, ...w.args)
        .map((r) => { const o = r as unknown as { x: string; y: string; g: number; w: number }; return [o.x, o.y, o.g, o.w] as [string, string, number, number]; });
      // Same lane pairs split by the role both played, so a top-lane record never feeds a jungle number.
      const roleMatchups = q<{ x: string; y: string; r: string; g: number; w: number }>(`SELECT a.champion x, b.champion y, a.role r, COUNT(*) g, SUM(a.win) w FROM participants a JOIN participants b ON a.match_id = b.match_id AND a.champion < b.champion
        AND a.team <> b.team AND a.role IS NOT NULL AND a.role = b.role JOIN matches m ON m.id = a.match_id WHERE 1=1${w.sql} GROUP BY a.champion, b.champion, a.role HAVING g >= ${min}`, ...w.args)
        .map((o) => [o.x, o.y, o.r, o.g, o.w] as [string, string, string, number, number]);
      const roleChampions = champions.filter((r) => r.role).map((r) => ({ id: r.champion, role: r.role as string, games: r.games, wins: r.wins }));
      return { roleChampions, roleMatchups, games: this.matchCount(f), champions: [...per].map(([id, e]) => ({ id, games: e.games, wins: e.wins, roles: [...e.roles].filter(([, g]) => g >= Math.max(2, e.games * 0.1)).map(([r]) => r) })), matchups: pairs(false), synergies: pairs(true), profiles: this.compProfiles(f) };
    },
    /** Which slice of this player's match history the next crawl reads (0 = the newest games; back to 0 once the history is done). */
    setSeedDepth: (puuid: string, depth: number) => void db.prepare("UPDATE seeds SET depth = ? WHERE puuid = ?").run(depth, puuid),
    markCrawled: (puuid: string, at: number) => void db.prepare("UPDATE seeds SET crawled_at = ? WHERE puuid = ?").run(at, puuid),
    counts: () => ({ matches: (db.prepare("SELECT COUNT(*) n FROM matches").get() as { n: number }).n, seeds: (db.prepare("SELECT COUNT(*) n FROM seeds").get() as { n: number }).n,
      crawled: (db.prepare("SELECT COUNT(*) n FROM seeds WHERE crawled_at > 0").get() as { n: number }).n }),
    /** The newest patch seen in the collected games (numeric order, not by the clock or by the last game stored). */
    latestPatch(): string | undefined { return this.recentPatches(1)[0]; },
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
    buildRows(champion: string, f: Filter, role?: Role): { keystone: number | null; perks: string | null; items: string; spell1: number | null; spell2: number | null; win: number; skills: string | null; start: string | null; buys: string | null; duration: number }[] {
      const w = filt(f);
      return q(`SELECT p.keystone, p.perks, p.items, p.spell1, p.spell2, p.win, p.skills, p.start, p.buys, m.duration FROM participants p JOIN matches m ON m.id = p.match_id WHERE p.champion = ?${role ? " AND p.role = ?" : ""}${w.sql}`, champion, ...(role ? [role] : []), ...w.args);
    },
    bans(f: Filter) { const w = filt(f); return q<{ k: number; n: number }>(`SELECT b.champion_key k, COUNT(*) n FROM bans b JOIN matches m ON m.id = b.match_id WHERE 1=1${w.sql} GROUP BY k`, ...w.args); },
    /** Lane matchups: same role, opposite team. */
    matchups(champion: string, f: Filter): Row[] { const w = filt(f); return q<Row>(`SELECT b.champion name, COUNT(*) games, SUM(a.win) wins FROM participants a JOIN participants b ON a.match_id = b.match_id AND a.team <> b.team AND a.role IS NOT NULL AND a.role = b.role
      JOIN matches m ON m.id = a.match_id WHERE a.champion = ?${w.sql} GROUP BY b.champion ORDER BY games DESC`, champion, ...w.args); },
    /**
     * Lane opponents (same role, other team) and teammates (other four roles, same team) of `champion` while it plays `role`.
     * Pairs with fewer than `min` games are left out; the busiest `limit` of each list are kept.
     */
    relations(champion: string, role: string, f: Filter, min = 5, limit = 100): { matchups: Rel[]; synergies: Rel[] } {
      const w = filt(f);
      const run = (on: string) => q<Rel>(`SELECT b.champion champion, b.role role, COUNT(*) games, SUM(a.win) wins FROM participants a JOIN participants b ON a.match_id = b.match_id AND ${on}
        JOIN matches m ON m.id = a.match_id WHERE a.champion = ? AND a.role = ?${w.sql} GROUP BY b.champion, b.role HAVING games >= ${Math.max(1, Math.floor(min))} ORDER BY games DESC, b.champion LIMIT ${Math.max(1, Math.floor(limit))}`, champion, role, ...w.args);
      return { matchups: run("a.team <> b.team AND b.role = a.role"), synergies: run("a.team = b.team AND a.rowid <> b.rowid AND b.role IS NOT NULL AND b.role <> a.role") };
    },
    /**
     * Games and wins per patch, per champion and role, for the patches in `f` (the caller passes every kept patch). Optionally one champion.
     * Together with matchesByPatch and bansByPatch this is everything a patch comparison needs.
     */
    championRowsByPatch(f: Filter, champion?: string): { patch: string; champion: string; role: string | null; games: number; wins: number }[] {
      const w = filt(f);
      return q(`SELECT m.patch patch, p.champion champion, p.role role, COUNT(*) games, SUM(p.win) wins FROM participants p JOIN matches m ON m.id = p.match_id WHERE 1=1${w.sql}${champion ? " AND p.champion = ?" : ""} GROUP BY m.patch, p.champion, p.role`, ...w.args, ...(champion ? [champion] : []));
    },
    /** Collected games per patch (the denominator of pick and ban rates). */
    matchesByPatch(f: Filter): Map<string, number> { const w = filt(f); return new Map(q<{ patch: string; n: number }>(`SELECT m.patch patch, COUNT(*) n FROM matches m WHERE 1=1${w.sql} GROUP BY m.patch`, ...w.args).map((r) => [r.patch, r.n])); },
    /** Bans per patch, keyed `patch|championKey`. */
    bansByPatch(f: Filter): Map<string, number> { const w = filt(f); return new Map(q<{ patch: string; k: number; n: number }>(`SELECT m.patch patch, b.champion_key k, COUNT(*) n FROM bans b JOIN matches m ON m.id = b.match_id WHERE 1=1${w.sql} GROUP BY m.patch, b.champion_key`, ...w.args).map((r) => [`${r.patch}|${r.k}`, r.n])); },
    keystones(champion: string, f: Filter): { id: number; games: number; wins: number }[] { const w = filt(f); return q(`SELECT p.keystone id, COUNT(*) games, SUM(p.win) wins FROM participants p JOIN matches m ON m.id = p.match_id
      WHERE p.champion = ? AND p.keystone IS NOT NULL${w.sql} GROUP BY p.keystone ORDER BY games DESC LIMIT 6`, champion, ...w.args); },
    items(champion: string, f: Filter): { id: number; games: number; wins: number }[] { const w = filt(f); return q(`SELECT CAST(j.value AS INTEGER) id, COUNT(*) games, SUM(p.win) wins FROM participants p JOIN matches m ON m.id = p.match_id, json_each(p.items) j
      WHERE p.champion = ?${w.sql} GROUP BY j.value ORDER BY games DESC LIMIT 40`, champion, ...w.args); },
  };
}
export type Store = ReturnType<typeof makeStore>;

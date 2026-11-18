import { extraItems } from "./participantItems";
import type { Loadout, LiveGame, PostGameRecap, RecapMetric, MasteryEntry, MatchDetail, MatchSummary, Participant, RankInfo, Role, Summoner, Tier } from "@apex/schema";
import { canonicalChampionId } from "./champions";
import { HttpError, type LeagueEntry, type RiotActiveGame, type RiotMastery, type RiotMatch, type RiotParticipant } from "./riot";

const ROLES: Record<string, Role> = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" };
const QUEUES: Record<number, string> = { 420: "Ranked Solo", 440: "Ranked Flex", 400: "Normal Draft", 430: "Normal Blind", 450: "ARAM", 480: "Swiftplay", 490: "Quickplay", 1700: "Arena", 1710: "Arena", 1740: "Arena 3v3", 1750: "Arena 3v3" };
export const roleOf = (pos: string | undefined): Role | null => ROLES[pos ?? ""] ?? null;
export const queueName = (id: number) => QUEUES[id] ?? `Queue ${id}`;

export function toRank(entries: LeagueEntry[]): RankInfo | null {
  const e = entries.find((x) => x.queueType === "RANKED_SOLO_5x5");
  return e ? { tier: e.tier as Tier, division: e.rank as RankInfo["division"], lp: e.leaguePoints, wins: e.wins, losses: e.losses } : null;
}
export const toSummoner = (riotId: string, level: number, entries: LeagueEntry[]): Summoner => ({ riotId, level, rank: toRank(entries) });

function endTime(m: RiotMatch) { const i = m.info; return i.gameEndTimestamp ?? i.gameCreation + i.gameDuration * 1000; }
export function toMatchSummary(m: RiotMatch, puuid: string): MatchSummary | null {
  const p = m.info.participants.find((x) => x.puuid === puuid);
  if (!p) return null;
  return { id: m.metadata.matchId, champion: canonicalChampionId(p.championName), role: ROLES[p.teamPosition] ?? null, win: p.win, kills: p.kills, deaths: p.deaths, assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled, durationSec: m.info.gameDuration, queue: queueName(m.info.queueId), playedAt: new Date(endTime(m)).toISOString(),
    queueId: m.info.queueId, ...(p.champLevel ? { level: p.champLevel } : {}), loadout: toLoadout(p) };
}
/**
 * The items, spells and runes of one player in a finished game. Zero ids (empty slots) are dropped; the trinket is slot 6.
 * The role quest slot (extra item fields) is kept apart as `roleItem`: merged into `items` it only showed when a normal slot was free. Pure.
 */
export function toLoadout(p: RiotParticipant): Loadout {
  const items = [...new Set([p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((x): x is number => !!x))];
  const roleItem = extraItems(p).find((x) => !items.includes(x));
  return { items, ...(roleItem ? { roleItem } : {}), trinket: p.item6 || null, spells: [p.summoner1Id, p.summoner2Id].filter((x): x is number => !!x),
    keystone: p.perks?.styles?.[0]?.selections?.[0]?.perk ?? null, secondaryStyle: p.perks?.styles?.[1]?.style ?? null };
}
export function toMatchDetail(m: RiotMatch, puuid?: string): MatchDetail {
  const participants: Participant[] = m.info.participants.map((p, i) => ({
    name: p.riotIdGameName || p.summonerName || `Player ${i + 1}`, loadout: toLoadout(p), champion: canonicalChampionId(p.championName), team: p.teamId === 100 ? "blue" : "red",
    kills: p.kills, deaths: p.deaths, assists: p.assists, cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    damage: p.totalDamageDealtToChampions, gold: p.goldEarned, vision: p.visionScore, isYou: !!puuid && p.puuid === puuid }));
  const names = new Set<string>(); // names are React keys in the UI, so make them unique
  participants.forEach((p, i) => { if (names.has(p.name)) p.name = `${p.name} (${i + 1})`; names.add(p.name); });
  return { id: m.metadata.matchId, blueWon: m.info.participants.find((p) => p.teamId === 100)?.win ?? false, participants };
}
export function toMastery(list: RiotMastery[], champs: Map<number, { id: string; name: string }>): MasteryEntry[] {
  return list.flatMap((m) => { const c = champs.get(m.championId); return c ? [{ champion: c.id, name: c.name, level: m.championLevel, points: m.championPoints }] : []; });
}

const SMITE = 11;
/**
 * Spectator-v5 game -> what the Live Game screen shows. `entries` holds each player's league entries (missing = rank unavailable),
 * `pop` the collected per-champion totals. Pure, so it is easy to test.
 */
export function toLiveGame(g: RiotActiveGame, o: { youPuuid: string; champs: Map<number, { id: string; name: string }>; entries: Map<string, LeagueEntry[]>; pop: Map<string, { games: number; wins: number }> }): LiveGame {
  const side = (teamId: number) => (teamId === 100 ? "blue" : "red") as "blue" | "red";
  const champ = (id: number) => o.champs.get(id) ?? { id: String(id), name: `Champion ${id}` };
  return {
    inGame: true, queue: g.gameQueueConfigId ? queueName(g.gameQueueConfigId) : g.gameMode, mode: g.gameMode, lengthSec: Math.max(0, g.gameLength),
    bans: (g.bannedChampions ?? []).filter((b) => b.championId > 0).map((b) => ({ champion: champ(b.championId).id, championName: champ(b.championId).name, team: side(b.teamId) })),
    players: g.participants.map((p) => {
      const c = champ(p.championId), list = p.puuid ? o.entries.get(p.puuid) ?? [] : [], solo = list.find((e) => e.queueType === "RANKED_SOLO_5x5"), pop = o.pop.get(c.id);
      return { riotId: p.riotId || (p.bot ? "Bot" : "Hidden player"), champion: c.id, championName: c.name, team: side(p.teamId), rank: toRank(list), hotStreak: !!solo?.hotStreak,
        jungle: p.spell1Id === SMITE || p.spell2Id === SMITE, isYou: !!p.puuid && p.puuid === o.youPuuid, champGames: pop?.games ?? 0, champWins: pop?.wins ?? 0 };
    }),
  };
}

/** One player's numbers for a game: kda per game, the rest per minute. */
export interface PerGame { kda: number; cs: number; damage: number; gold: number }
export const perGame = (p: RiotParticipant, durationSec: number): PerGame => { const min = Math.max(1, durationSec) / 60; return {
  kda: (p.kills + p.assists) / Math.max(1, p.deaths), cs: (p.totalMinionsKilled + p.neutralMinionsKilled) / min, damage: p.totalDamageDealtToChampions / min, gold: p.goldEarned / min }; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const METRICS: { id: RecapMetric["id"]; label: string; unit: string }[] = [{ id: "kda", label: "KDA", unit: "" }, { id: "cs", label: "CS per minute", unit: "/min" }, { id: "damage", label: "Damage per minute", unit: "/min" }, { id: "gold", label: "Gold per minute", unit: "/min" }];

/**
 * One finished game for the Post-game recap. `baseline` = collected averages for comparable games, `personal` = the same numbers for the
 * player's other recent games in this role (needs 3 or more to be shown). Lobby rank and shares come from the match itself. Pure.
 */
export function toRecap(m: RiotMatch, puuid: string, o: { names: Map<string, string>; baseline: { label: string; avg: PerGame; games: number } | null; personal: PerGame[] }): PostGameRecap {
  const me = m.info.participants.find((x) => x.puuid === puuid);
  if (!me) throw new HttpError(404, "This player was not in that match");
  const dur = m.info.gameDuration, all = m.info.participants.map((p) => perGame(p, dur)), mine = perGame(me, dur), team = m.info.participants.filter((p) => p.teamId === me.teamId);
  const teamKills = team.reduce((s, p) => s + p.kills, 0), teamDamage = team.reduce((s, p) => s + p.totalDamageDealtToChampions, 0);
  const personal = o.personal.length >= 3 ? o.personal : null;
  return {
    matchId: m.metadata.matchId, queue: queueName(m.info.queueId), win: me.win, durationSec: dur, playedAt: new Date(endTime(m)).toISOString(),
    champion: canonicalChampionId(me.championName), championName: o.names.get(canonicalChampionId(me.championName)) ?? canonicalChampionId(me.championName), role: ROLES[me.teamPosition] ?? null, kills: me.kills, deaths: me.deaths, assists: me.assists,
    killParticipation: teamKills > 0 ? (me.kills + me.assists) / teamKills : 0, damageShare: teamDamage > 0 ? me.totalDamageDealtToChampions / teamDamage : 0, loadout: toLoadout(me),
    metrics: METRICS.map(({ id, label, unit }) => ({ id, label, unit, you: mine[id], vsRank: o.baseline ? o.baseline.avg[id] : null, vsYou: personal ? mean(personal.map((g) => g[id])) : null,
      lobbyRank: 1 + all.filter((g) => g[id] > mine[id]).length })),
    baseline: o.baseline ? { label: o.baseline.label, games: o.baseline.games } : null, personal: personal ? { games: personal.length } : null,
  };
}

import type { MatchSummary, Role } from "@apex/schema";

/** One champion over a list of finished games (sums, so averages stay exact when more games are added). */
export interface ChampionPerf { champion: string; games: number; wins: number; kills: number; deaths: number; assists: number; cs: number; seconds: number }
/** One role over a list of finished games. */
export interface RolePerf { role: Role; games: number; wins: number }

/** Busiest first, then more wins, then the key (so the order never jumps between renders). */
const busiest = <T extends { games: number; wins: number }>(a: T, b: T, key: (x: T) => string) => b.games - a.games || b.wins - a.wins || key(a).localeCompare(key(b));

/** Games, wins, KDA parts and CS per champion, most played first. Only the games given are counted (the caller says how many that is). */
export function championPerformance(ms: readonly MatchSummary[]): ChampionPerf[] {
  const by = new Map<string, ChampionPerf>();
  for (const m of ms) {
    const e = by.get(m.champion) ?? { champion: m.champion, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, seconds: 0 };
    e.games++; if (m.win) e.wins++; e.kills += m.kills; e.deaths += m.deaths; e.assists += m.assists; e.cs += m.cs; e.seconds += m.durationSec;
    by.set(m.champion, e);
  }
  return [...by.values()].sort((a, b) => busiest(a, b, (x) => x.champion));
}

/** Games and wins per role, most played first. Games without a role (ARAM, Arena) are left out. */
export function rolePerformance(ms: readonly MatchSummary[]): RolePerf[] {
  const by = new Map<Role, RolePerf>();
  for (const m of ms) {
    if (!m.role) continue;
    const e = by.get(m.role) ?? { role: m.role, games: 0, wins: 0 };
    e.games++; if (m.win) e.wins++; by.set(m.role, e);
  }
  return [...by.values()].sort((a, b) => busiest(a, b, (x) => x.role));
}

/** (kills + assists) / deaths, or null for a game set without a death ("Perfect"). */
export const kdaOf = (kills: number, deaths: number, assists: number): number | null => (deaths === 0 ? null : (kills + assists) / deaths);
/** Creep score per minute over summed CS and summed seconds; 0 without time. */
export const csPerMin = (cs: number, seconds: number) => (seconds > 0 ? cs / (seconds / 60) : 0);

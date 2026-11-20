import type { PlayedWithEntry, PlayerOverview } from "@apex/schema";
import type { RiotMatch } from "./riot";

/** Teammates shown at most, and the games together a teammate needs to be listed. */
export const PLAYED_WITH_MAX = 8, PLAYED_WITH_MIN_GAMES = 2;

/**
 * Teammates (same team, not you) seen in at least two of the given games, most games first, 
 * Teammates are matched by puuid (names change); the shown name comes from the latest game they appear in (games are newest first).
 * Pure.
 */
export function toOverview(matches: readonly RiotMatch[], puuid: string): PlayerOverview {
  const mates = new Map<string, PlayedWithEntry>();
  let games = 0;
  for (const m of matches) {
    const me = m.info.participants.find((p) => p.puuid === puuid);
    if (!me) continue;
    games++;
    for (const p of m.info.participants) {
      if (p.puuid === puuid || p.teamId !== me.teamId) continue;
      const tag = p.riotIdGameName && p.riotIdTagline ? `${p.riotIdGameName}#${p.riotIdTagline}` : undefined;
      const e = mates.get(p.puuid) ?? { name: p.riotIdGameName || p.summonerName || "Unknown", ...(tag ? { riotId: tag } : {}), games: 0, wins: 0 };
      e.games++; if (p.win) e.wins++; mates.set(p.puuid, e);
    }
  }
  const playedWith = [...mates.values()].filter((e) => e.games >= PLAYED_WITH_MIN_GAMES)
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name)).slice(0, PLAYED_WITH_MAX);
  return { games, playedWith };
}

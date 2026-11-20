import type { LiveRoleHistory, Role } from "@apex/schema";
import { roleOf } from "./mapping";
import type { RiotMatch } from "./riot";

/** How many recent games per player are read (each is one cached match fetch; 5 x 10 players keeps a dev key usable). */
export const HISTORY_GAMES = 5;

/** Counts the roles one player was assigned (Riot's `teamPosition`) in the given matches. Games without a usable position are skipped. Pure. */
export function roleCounts(matches: readonly RiotMatch[], puuid: string): LiveRoleHistory["players"][number] {
  const roles: Partial<Record<Role, number>> = {};
  let games = 0;
  for (const m of matches) {
    const r = roleOf(m.info.participants.find((x) => x.puuid === puuid)?.teamPosition);
    if (!r) continue;
    roles[r] = (roles[r] ?? 0) + 1; games++;
  }
  return { riotId: "", games, roles };
}

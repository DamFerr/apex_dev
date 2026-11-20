import type { DraftState } from "./draft";
import { roleFromPosition } from "./draft";
import { isInGame, type OverlayPick } from "./overlay";

/** One player entry of `gameData.teamOne` / `teamTwo` in the client's gameflow session (only the fields Apex reads). */
export interface GameflowPlayer { championId?: number; selectedPosition?: string; summonerId?: number; puuid?: string; summonerInternalName?: string }
/** `GET /lol-gameflow/v1/session`: the client's own record of the running game. Apex reads only YOUR entry (your champion and role, which the client shows you). */
export interface GameflowSession { gameData?: { teamOne?: GameflowPlayer[]; teamTwo?: GameflowPlayer[] } }
/** Who you are, from `GET /lol-summoner/v1/current-summoner`. Either id is enough. */
export interface Me { summonerId?: number; puuid?: string }

/**
 * Your champion and role from the gameflow session, for when Apex starts after champ select (so no lock-in was ever seen).
 * Matches YOUR entry only, by summoner id or puuid. Null when you are not found, the champion is unset (0), or a spectated game lists you nowhere.
 * Never reads another player's entry.
 */
export function pickFromGameflowSession(session: GameflowSession | null | undefined, me: Me | null | undefined): OverlayPick | null {
  if (!me || (me.summonerId === undefined && !me.puuid)) return null;
  const players = [...(session?.gameData?.teamOne ?? []), ...(session?.gameData?.teamTwo ?? [])];
  const mine = players.find((p) => (me.summonerId !== undefined && p.summonerId === me.summonerId) || (!!me.puuid && p.puuid === me.puuid));
  if (!mine || !mine.championId || mine.championId <= 0) return null;
  return { championId: mine.championId, role: mine.selectedPosition ? roleFromPosition(mine.selectedPosition) : null };
}

/** Phases where the overlay may need a pick but none is remembered: loading screen and game. (Same set `nextPick` keeps a pick through.) */
export const needsPickResume = (memory: OverlayPick | null, draft: DraftState): boolean =>
  memory === null && draft.connected && (draft.gameflow === "GameStart" || isInGame(draft.gameflow));

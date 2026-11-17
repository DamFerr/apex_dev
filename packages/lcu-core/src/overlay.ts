import type { Role } from "@apex/schema";
import type { DraftState } from "./draft";
import type { GameflowPhase } from "./types";

/** The champion the local player locked in champ select, remembered so the overlay still knows it once the game has started. */
export interface OverlayPick { championId: number; role: Role | null }

/** Phases in which a game is running (the loading screen is GameStart, which is not "in game" yet). */
const IN_GAME: GameflowPhase[] = ["InProgress", "Reconnect"];
export const isInGame = (phase: GameflowPhase) => IN_GAME.includes(phase);
/** Phases between the lock-in and the end of the game: the pick must survive these, because the draft state is reset when champ select ends. */
const KEEP: GameflowPhase[] = ["GameStart", ...IN_GAME];

/**
 * The pick the overlay should show after `next`. A lock-in sets it; the phases from loading screen to game keep it; anything else
 * (a new champ select without a lock, a dodge, the lobby, end of game, the client closing) clears it, so a stale champion never shows in the next game.
 */
export function nextPick(memory: OverlayPick | null, next: DraftState): OverlayPick | null {
  if (next.localLocked) return { championId: next.localLocked.championId, role: next.localLocked.role };
  return next.connected && KEEP.includes(next.gameflow) ? memory : null;
}

/**
 * Should the overlay window be on screen? Only when the player turned it on and a game is running (so it never covers the client),
 * or while previewing from Settings. Without a remembered pick the overlay has nothing to show, so it stays hidden unless previewing.
 */
export function overlayWanted(o: { enabled: boolean; preview: boolean; phase: GameflowPhase; pick: OverlayPick | null }): boolean {
  return o.preview || (o.enabled && isInGame(o.phase) && o.pick !== null);
}

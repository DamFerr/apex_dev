import type { GameflowPhase } from "./types";

/** Phases of a running game, and the phases a finished game moves to. Phase names are the League client's gameflow phases. */
const RUNNING: GameflowPhase[] = ["InProgress", "Reconnect"];
const AFTER: GameflowPhase[] = ["WaitingForStats", "PreEndOfGame", "EndOfGame", "Lobby"];

/**
 * True exactly once per game: the moment a running game (InProgress / Reconnect) hands over to the end-of-game phases or back to the lobby.
 * Later steps (WaitingForStats -> EndOfGame -> Lobby) do not count again, and neither does losing the connection to the client ("None"),
 * which says nothing about the game having ended.
 */
export const gameEnded = (prev: GameflowPhase, next: GameflowPhase): boolean => RUNNING.includes(prev) && AFTER.includes(next);

/**
 * Riot's API shows the new rank a little after the game ends, so Apex asks twice: once soon and once later. A lookup that finds nothing new
 * stores nothing (snapshots are only saved when the rank changed), so the second try is free of side effects.
 */
export const RANK_REFRESH_DELAYS_MS = [30_000, 120_000] as const;

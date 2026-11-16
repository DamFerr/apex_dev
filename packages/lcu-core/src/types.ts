/** Minimal shapes of the League client (LCU) champ select data that Apex uses. */
export type GameflowPhase = string; // "None" | "Lobby" | "ReadyCheck" | "ChampSelect" | "InProgress" | ...
export interface LcuMember { cellId: number; championId: number; championPickIntent: number; assignedPosition: string }
export interface LcuAction { id: number; actorCellId: number; championId: number; completed: boolean; isAllyAction: boolean; type: string; isInProgress?: boolean }
export interface ChampSelectSession {
  localPlayerCellId: number; myTeam: LcuMember[]; theirTeam: LcuMember[];
  bans: { myTeamBans: number[]; theirTeamBans: number[] };
  actions: LcuAction[][]; timer: { phase: string; adjustedTimeLeftInPhase: number };
}
/** Transport-independent events. Both the dev simulator's WebSocket and the real Rust connector produce these. */
export type LcuEvent =
  | { type: "connected" } | { type: "disconnected" }
  | { type: "gameflow"; phase: GameflowPhase }
  | { type: "session"; session: ChampSelectSession } | { type: "sessionEnded" };

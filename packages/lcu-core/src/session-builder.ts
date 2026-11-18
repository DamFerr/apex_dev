import type { ChampSelectSession, LcuAction, LcuMember } from "./types";

const POS = ["top", "jungle", "middle", "bottom", "utility"];
export interface Sim { bans: [number[], number[]]; hover: Record<number, number>; locked: Record<number, number>; localCell?: number; banTurn?: number; pickTurn?: number; pickWaiting?: number }
/** Builds a realistic session snapshot. Used by the mock server and by tests. Cells 0-4 are your team. */
export function buildSession(sim: Sim): ChampSelectSession {
  const member = (cellId: number): LcuMember => ({
    cellId, championId: sim.locked[cellId] ?? 0, championPickIntent: sim.hover[cellId] ?? 0, assignedPosition: POS[cellId % 5],
  });
  const actions: LcuAction[] = Object.entries(sim.locked).map(([cell, championId], i) => ({
    id: i, actorCellId: Number(cell), championId, completed: true, isAllyAction: Number(cell) < 5, type: "pick" }));
  // banTurn: that cell currently has an unfinished ban action (the real client shows this during the ban phase).
  if (sim.banTurn !== undefined) actions.push({ id: 99, actorCellId: sim.banTurn, championId: 0, completed: false, isAllyAction: true, type: "ban", isInProgress: true });
  if (sim.pickTurn !== undefined) actions.push({ id: 98, actorCellId: sim.pickTurn, championId: 0, completed: false, isAllyAction: true, type: "pick", isInProgress: true });
  // pickWaiting: that cell has an unfinished pick action that is not its turn yet (ban phase).
  if (sim.pickWaiting !== undefined) actions.push({ id: 97, actorCellId: sim.pickWaiting, championId: 0, completed: false, isAllyAction: true, type: "pick", isInProgress: false });
  return {
    localPlayerCellId: sim.localCell ?? 2,
    myTeam: [0, 1, 2, 3, 4].map(member), theirTeam: [5, 6, 7, 8, 9].map(member),
    bans: { myTeamBans: sim.bans[0], theirTeamBans: sim.bans[1] },
    actions: [actions], timer: { phase: "BAN_PICK", adjustedTimeLeftInPhase: 30000 },
  };
}

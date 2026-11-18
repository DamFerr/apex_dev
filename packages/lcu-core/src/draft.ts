import type { Role } from "@apex/schema";
import type { ChampSelectSession, GameflowPhase, LcuEvent, LcuMember } from "./types";

export interface Slot { cellId: number; team: "ally" | "enemy"; role: Role | null; championId: number; hoverId: number; locked: boolean; isLocal: boolean }
export interface LocalLock { championId: number; role: Role | null }
export interface DraftState {
  connected: boolean; gameflow: GameflowPhase; active: boolean; slots: Slot[];
  bans: { ally: number[]; enemy: number[] }; banning: boolean; secondsLeft: number; localLocked: LocalLock | null;
  /** Your own unfinished client actions. `pick`: the pick action id (also during the ban phase, before your turn), `pickLive`: it is your pick turn now (you may lock in). `ban`: your ban action id, only while it is your ban turn. */
  myActions: { pick: number | null; pickLive: boolean; ban: number | null };
}
export const initialDraft: DraftState = {
  connected: false, gameflow: "None", active: false, slots: [], bans: { ally: [], enemy: [] }, banning: false, secondsLeft: 0, localLocked: null, myActions: { pick: null, pickLive: false, ban: null },
};

const ROLE_MAP: Record<string, Role> = { top: "TOP", jungle: "JUNGLE", middle: "MID", bottom: "ADC", utility: "SUPPORT" };
export const roleFromPosition = (p: string): Role | null => ROLE_MAP[p.toLowerCase()] ?? null;

function fromSession(s: DraftState, session: ChampSelectSession): DraftState {
  // A pick is final only when its action is completed; otherwise the champion is just hovered.
  const picks = new Map<number, number>();
  for (const a of session.actions.flat()) if (a.type === "pick" && a.completed && a.championId > 0) picks.set(a.actorCellId, a.championId);
  const slot = (m: LcuMember, team: Slot["team"]): Slot => {
    const lock = picks.get(m.cellId);
    return { cellId: m.cellId, team, role: roleFromPosition(m.assignedPosition), championId: lock ?? 0,
      hoverId: lock ? 0 : m.championPickIntent || m.championId || 0, locked: lock !== undefined, isLocal: m.cellId === session.localPlayerCellId };
  };
  // Ban lists are not always filled (e.g. custom games), so also read completed "ban" actions.
  const banned = (ally: boolean, listed: number[]) => [...new Set([...listed, ...session.actions.flat()
    .filter((a) => a.type === "ban" && a.completed && a.isAllyAction === ally).map((a) => a.championId)])].filter((b) => b > 0);
  const mineOf = (type: string) => session.actions.flat().find((a) => a.type === type && a.actorCellId === session.localPlayerCellId && !a.completed);
  const myPick = mineOf("pick"), myBan = mineOf("ban");
  const slots = [...session.myTeam.map((m) => slot(m, "ally")), ...session.theirTeam.map((m) => slot(m, "enemy"))];
  const me = slots.find((x) => x.isLocal && x.locked);
  return {
    ...s, active: true, slots,
    banning: session.actions.flat().some((a) => a.type === "ban" && a.actorCellId === session.localPlayerCellId && !a.completed && a.isInProgress !== false), secondsLeft: Math.max(0, Math.round(session.timer.adjustedTimeLeftInPhase / 1000)),
    bans: { ally: banned(true, session.bans?.myTeamBans ?? []), enemy: banned(false, session.bans?.theirTeamBans ?? []) },
    myActions: { pick: myPick?.id ?? null, pickLive: myPick?.isInProgress === true, ban: myBan?.isInProgress === true ? myBan.id : null },
    localLocked: me ? { championId: me.championId, role: me.role } : null,
  };
}

/** Pure reducer: all champ select logic lives here so it can be unit tested without the game. */
export function reduce(s: DraftState, e: LcuEvent): DraftState {
  switch (e.type) {
    case "connected": return { ...s, connected: true };
    case "disconnected": return { ...initialDraft };
    case "gameflow": return e.phase === "ChampSelect" ? { ...s, gameflow: e.phase } : { ...initialDraft, connected: s.connected, gameflow: e.phase };
    case "sessionEnded": return { ...initialDraft, connected: s.connected, gameflow: s.gameflow };
    case "session": return fromSession(s, e.session);
  }
}

/** Returns the pick to import when the local player newly locks in (or changes a locked pick). Off unless enabled. */
export function shouldImport(prev: DraftState, next: DraftState, opts: { autoImport: boolean }): LocalLock | null {
  if (!opts.autoImport || !next.localLocked) return null;
  return prev.localLocked?.championId === next.localLocked.championId ? null : next.localLocked;
}

/** Converts a raw LCU WebSocket frame ([8, "OnJsonApiEvent", {...}]) into an event, or null if irrelevant. */
export function parseLcuMessage(raw: string): LcuEvent | null {
  let msg: unknown;
  try { msg = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(msg) || msg[0] !== 8 || msg[1] !== "OnJsonApiEvent") return null;
  const { uri, eventType, data } = msg[2] ?? {};
  if (uri === "/lol-gameflow/v1/gameflow-phase") return { type: "gameflow", phase: eventType === "Delete" ? "None" : String(data) };
  if (uri === "/lol-champ-select/v1/session") return eventType === "Delete" ? { type: "sessionEnded" } : { type: "session", session: data };
  return null;
}

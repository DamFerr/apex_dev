import type { DraftState } from "./draft";

/** Requests to the League client for ONE user click. They only ever touch your own champ select action. */
export interface LcuRequest { method: "PATCH" | "POST"; path: string; body?: { championId: number; completed?: true } }
export type ActionPlan = { ok: true; id: number; request: LcuRequest; fallback?: LcuRequest } | { ok: false; reason: string };
/** hover = show the champion in your slot; commit = hover and finish the action: lock in (pick) or ban. */
export type Step = "hover" | "commit";

/** Champions that cannot be picked or banned again: every locked pick and every ban. */
export const takenChampions = (d: Pick<DraftState, "slots" | "bans">): Set<number> =>
  new Set([...d.slots.filter((s) => s.locked && s.championId > 0).map((s) => s.championId), ...d.bans.ally, ...d.bans.enemy]);

/**
 * Pure planning of ONE user click (nothing is sent here, nothing runs on its own).
 *  - Hover a pick: any time you have an unfinished pick action, so before and during the ban phase too.
 *  - Lock in: only on your pick turn (after the ban phase).
 *  - Hover or ban a champion: only on your own ban turn.
 * Refuses banned or already picked champions. A commit is one PATCH {championId, completed: true}; `fallback` (POST .../complete)
 * is what the caller may try once if the client did not accept it.
 */
export function planAction(d: DraftState, kind: "pick" | "ban", step: Step, championId: number): ActionPlan {
  if (!d.active) return { ok: false, reason: "Champ select is not running." };
  const id = d.myActions[kind];
  if (id === null) return { ok: false, reason: kind === "ban" ? "It is not your ban turn." : "You have no pick left to hover (already locked in?)." };
  if (kind === "pick" && step === "commit" && !d.myActions.pickLive) return { ok: false, reason: "You can lock in on your pick turn, after the bans." };
  if (!Number.isInteger(championId) || championId <= 0) return { ok: false, reason: "Unknown champion." };
  if (takenChampions(d).has(championId)) return { ok: false, reason: "That champion is banned or already picked." };
  const path = `/lol-champ-select/v1/session/actions/${id}`;
  if (step === "hover") return { ok: true, id, request: { method: "PATCH", path, body: { championId } } };
  return { ok: true, id, request: { method: "PATCH", path, body: { championId, completed: true } }, fallback: { method: "POST", path: `${path}/complete` } };
}

import type { Slot } from "@apex/lcu-core";

/**
 * Client-side "what-if" layer on top of the real champ select (PLAN.md G.3). It only changes what Apex DISPLAYS and
 * evaluates: nothing is ever sent to the League client. Pure functions, so the undo logic is easy to test.
 */
export type Team = Slot["team"];
export interface Bans { ally: number[]; enemy: number[] }
interface Snapshot { picks: Record<number, number>; bans: Bans }
export interface WhatIf extends Snapshot { history: Snapshot[] }

/** `picks[cellId]`: the champion locked there in the what-if (0 = slot emptied). A missing key means the real slot is used. */
export const emptyWhatIf: WhatIf = { picks: {}, bans: { ally: [], enemy: [] }, history: [] };
const MAX_HISTORY = 50;

export const isDirty = (w: WhatIf) => Object.keys(w.picks).length > 0 || w.bans.ally.length > 0 || w.bans.enemy.length > 0;
export const canUndo = (w: WhatIf) => w.history.length > 0;

/** Applies a change and remembers the previous state for undo; an unchanged result is not recorded. */
function commit(w: WhatIf, picks: Record<number, number>, bans: Bans): WhatIf {
  const changed = JSON.stringify([picks, bans]) !== JSON.stringify([w.picks, w.bans]);
  if (!changed) return w;
  return { picks, bans, history: [...w.history, { picks: w.picks, bans: w.bans }].slice(-MAX_HISTORY) };
}

/** Lock `champion` into a slot (0 empties it). */
export const setPick = (w: WhatIf, cellId: number, champion: number): WhatIf => commit(w, { ...w.picks, [cellId]: champion }, w.bans);

/** Back to the real state of one slot. */
export function resetPick(w: WhatIf, cellId: number): WhatIf {
  const { [cellId]: _gone, ...rest } = w.picks;
  return commit(w, rest, w.bans);
}

export const addBan = (w: WhatIf, team: Team, champion: number): WhatIf =>
  w.bans[team].includes(champion) ? w : commit(w, w.picks, { ...w.bans, [team]: [...w.bans[team], champion] });

export const removeBan = (w: WhatIf, team: Team, champion: number): WhatIf =>
  commit(w, w.picks, { ...w.bans, [team]: w.bans[team].filter((c) => c !== champion) });

export function undo(w: WhatIf): WhatIf {
  const prev = w.history[w.history.length - 1];
  return prev ? { picks: prev.picks, bans: prev.bans, history: w.history.slice(0, -1) } : w;
}

/** Drops every what-if edit (and the undo history). */
export const reset = (): WhatIf => emptyWhatIf;

/** The real draft with the what-if edits on top: overridden slots count as locked, extra bans are merged without duplicates. */
export function applyWhatIf(slots: Slot[], bans: Bans, w: WhatIf): { slots: Slot[]; bans: Bans } {
  const merge = (real: number[], extra: number[]) => [...real, ...extra.filter((c) => !real.includes(c))];
  return {
    slots: slots.map((s) => (s.cellId in w.picks ? { ...s, championId: w.picks[s.cellId], hoverId: 0, locked: w.picks[s.cellId] > 0 } : s)),
    bans: { ally: merge(bans.ally, w.bans.ally), enemy: merge(bans.enemy, w.bans.enemy) },
  };
}

/** Champions that cannot be picked or banned again: every locked pick and every ban. */
export const takenChampions = (slots: Slot[], bans: Bans): Set<number> =>
  new Set([...slots.filter((s) => s.locked && s.championId > 0).map((s) => s.championId), ...bans.ally, ...bans.enemy]);

/** Which slots differ from the real draft (they get a "what-if" mark). */
export const editedCells = (w: WhatIf): Set<number> => new Set(Object.keys(w.picks).map(Number));

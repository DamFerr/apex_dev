import { describe, expect, it } from "vitest";
import type { Slot } from "@apex/lcu-core";
import { addBan, applyWhatIf, canUndo, emptyWhatIf, isDirty, removeBan, reset, resetPick, setPick, takenChampions, undo } from "./whatIf";

const slot = (cellId: number, team: Slot["team"], championId = 0, locked = false): Slot => ({ cellId, team, role: null, championId, hoverId: locked ? 0 : 5, locked, isLocal: cellId === 0 });
const slots = [slot(0, "ally", 10, true), slot(1, "ally"), slot(5, "enemy", 20, true), slot(6, "enemy")];
const bans = { ally: [1], enemy: [2] };

describe("whatIf state", () => {
  it("starts clean and cannot undo", () => { expect(isDirty(emptyWhatIf)).toBe(false); expect(canUndo(emptyWhatIf)).toBe(false); });
  it("locks a champion into any slot, real or empty, on either team", () => {
    const w = setPick(setPick(emptyWhatIf, 1, 30), 5, 40);
    const v = applyWhatIf(slots, bans, w).slots;
    expect(v.find((s) => s.cellId === 1)).toMatchObject({ championId: 30, locked: true, hoverId: 0 });
    expect(v.find((s) => s.cellId === 5)).toMatchObject({ championId: 40, locked: true });
    expect(v.find((s) => s.cellId === 6)).toEqual(slots[3]);
  });
  it("0 empties a slot", () => expect(applyWhatIf(slots, bans, setPick(emptyWhatIf, 0, 0)).slots[0]).toMatchObject({ championId: 0, locked: false }));
  it("resetPick restores the real slot", () => expect(applyWhatIf(slots, bans, resetPick(setPick(emptyWhatIf, 0, 99), 0)).slots[0]).toEqual(slots[0]));
  it("adds bans without duplicating real or what-if bans, per team", () => {
    const w = addBan(addBan(addBan(emptyWhatIf, "ally", 7), "ally", 7), "enemy", 2);
    expect(applyWhatIf(slots, bans, w).bans).toEqual({ ally: [1, 7], enemy: [2] });
    expect(w.history.length).toBe(2); // the repeated what-if ban is not recorded; a real ban is only de-duplicated in the view (the picker never offers it)
  });
  it("removeBan only removes what-if bans", () => {
    const w = removeBan(addBan(emptyWhatIf, "enemy", 8), "enemy", 8);
    expect(applyWhatIf(slots, bans, w).bans).toEqual(bans);
  });
  it("undo steps back one change at a time, down to the real draft", () => {
    let w = setPick(emptyWhatIf, 1, 30); w = addBan(w, "ally", 7); w = setPick(w, 1, 31);
    w = undo(w); expect(w.picks[1]).toBe(30);
    w = undo(w); expect(w.bans.ally).toEqual([]);
    w = undo(w); expect(isDirty(w)).toBe(false); expect(canUndo(w)).toBe(false);
    expect(undo(w)).toBe(w);
  });
  it("an unchanged edit is not an undo step", () => { const w = setPick(emptyWhatIf, 1, 30); expect(setPick(w, 1, 30)).toBe(w); });
  it("reset drops edits and history", () => { const w = reset(); expect(isDirty(w)).toBe(false); expect(canUndo(w)).toBe(false); });
  it("keeps at most 50 undo steps", () => { let w = emptyWhatIf; for (let i = 1; i <= 60; i++) w = setPick(w, 1, i); expect(w.history.length).toBe(50); });
  it("does not mutate its input", () => { const w = setPick(emptyWhatIf, 1, 30); setPick(w, 2, 31); expect(w.picks).toEqual({ 1: 30 }); expect(emptyWhatIf.picks).toEqual({}); });
});

describe("takenChampions", () => {
  it("is every locked pick plus every ban, and ignores hovers and empties", () => {
    const v = applyWhatIf(slots, bans, setPick(emptyWhatIf, 1, 30));
    expect([...takenChampions(v.slots, v.bans)].sort((a, b) => a - b)).toEqual([1, 2, 10, 20, 30]);
  });
});

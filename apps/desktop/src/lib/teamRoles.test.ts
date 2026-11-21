import { describe, expect, it } from "vitest";
import { initialDraft, type DraftState, type Slot } from "@apex/lcu-core";
import { exactTeamRoles, nextAllyRoles } from "./teamRoles";

const slot = (cellId: number, role: Slot["role"], championId: number, over: Partial<Slot> = {}): Slot => ({ cellId, team: "ally", role, championId, hoverId: 0, locked: championId > 0, isLocal: false, ...over });
const draft = (slots: Slot[], active = true): DraftState => ({ ...initialDraft, active, slots });

describe("nextAllyRoles", () => {
  it("remembers locked allies with a role and ignores enemies, hovers and unassigned roles", () => {
    const next = draft([slot(0, "TOP", 75), slot(1, "JUNGLE", 0), slot(2, null, 12), slot(3, "MID", 10, { team: "enemy" })]);
    expect(nextAllyRoles({}, false, next)).toEqual({ 75: "TOP" });
  });
  it("keeps adding within one champ select, and a trade overwrites the champion's role", () => {
    const first = nextAllyRoles({}, false, draft([slot(0, "TOP", 75), slot(1, "MID", 1)]));
    expect(nextAllyRoles(first, true, draft([slot(0, "TOP", 75), slot(1, "MID", 1), slot(2, "ADC", 22)]))).toEqual({ 75: "TOP", 1: "MID", 22: "ADC" });
    expect(nextAllyRoles(first, true, draft([slot(0, "TOP", 1), slot(1, "MID", 75)]))).toEqual({ 75: "MID", 1: "TOP" });
  });
  it("starts empty for a new champ select (a dodge or the next game)", () => {
    expect(nextAllyRoles({ 99: "SUPPORT" }, false, draft([slot(0, "TOP", 75)]))).toEqual({ 75: "TOP" });
  });
  it("keeps the memory once champ select is over", () => {
    expect(nextAllyRoles({ 75: "TOP" }, true, draft([], false))).toEqual({ 75: "TOP" });
  });
});

describe("exactTeamRoles", () => {
  const idOf = (k: number) => ({ 1: "Annie", 2: "Olaf", 3: "Galio", 4: "Ashe", 5: "Alistar" } as Record<number, string>)[k];
  const team = ["Olaf", "Alistar", "Annie", "Ashe", "Galio"].map((champion) => ({ champion }));
  const all = { 1: "MID", 2: "JUNGLE", 3: "TOP", 4: "ADC", 5: "SUPPORT" } as const;
  it("returns the remembered role of each player, in team order (matching ids ignoring case)", () => {
    expect(exactTeamRoles(team, all, idOf)).toEqual(["JUNGLE", "SUPPORT", "MID", "ADC", "TOP"]);
    expect(exactTeamRoles(team.map((p) => ({ champion: p.champion.toUpperCase() })), all, idOf)).toEqual(["JUNGLE", "SUPPORT", "MID", "ADC", "TOP"]);
  });
  it("gives up (null) unless all five are known with five different roles", () => {
    expect(exactTeamRoles(team, { 1: "MID", 2: "JUNGLE", 3: "TOP", 4: "ADC" }, idOf)).toBeNull();
    expect(exactTeamRoles(team, { ...all, 5: "ADC" }, idOf)).toBeNull();
    expect(exactTeamRoles(team.slice(0, 4), all, idOf)).toBeNull();
    expect(exactTeamRoles(team.map((_, i) => ({ champion: `Other${i}` })), all, idOf)).toBeNull(); // the enemy team
  });
});

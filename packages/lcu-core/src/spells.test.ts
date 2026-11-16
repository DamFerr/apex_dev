import { describe, expect, it } from "vitest";
import type { Role } from "@apex/schema";
import { SPELLS, SPELL_NAMES, placeFlash, recommendSpells } from "./spells";

describe("recommendSpells", () => {
  const roles: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  it("always returns two different spells with Flash second", () => {
    for (const r of roles) { const [a, b] = recommendSpells(r); expect(a).not.toBe(b); expect(b).toBe(SPELLS.Flash); }
  });
  it("gives junglers Smite and toplaners Teleport", () => {
    expect(recommendSpells("JUNGLE")[0]).toBe(SPELLS.Smite);
    expect(recommendSpells("TOP")[0]).toBe(SPELLS.Teleport);
  });
  it("falls back to a sensible default when the role is unknown", () => expect(recommendSpells(null)).toEqual([SPELLS.Ignite, SPELLS.Flash]));
  it("can name every spell", () => expect(SPELL_NAMES[SPELLS.Flash]).toBe("Flash"));
});

describe("placeFlash", () => {
  const { Flash, Ignite, Smite, Teleport } = SPELLS;
  it("leaves Flash on F (second slot) unchanged", () => expect(placeFlash([Ignite, Flash], "F")).toEqual([Ignite, Flash]));
  it("moves Flash to D (first slot)", () => expect(placeFlash([Ignite, Flash], "D")).toEqual([Flash, Ignite]));
  it("also puts Flash on F when it arrives first", () => expect(placeFlash([Flash, Ignite], "F")).toEqual([Ignite, Flash]));
  it("does not reorder a pair without Flash", () => {
    expect(placeFlash([Smite, Teleport], "D")).toEqual([Smite, Teleport]);
    expect(placeFlash([Smite, Teleport], "F")).toEqual([Smite, Teleport]);
  });
  it("keeps both spells and does not mutate its input", () => {
    const pair: [number, number] = [Teleport, Flash], out = placeFlash(pair, "D");
    expect([...out].sort()).toEqual([...pair].sort()); expect(pair).toEqual([Teleport, Flash]);
  });
  it("works with every role default", () => {
    for (const r of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as Role[]) expect(placeFlash(recommendSpells(r), "D")[0]).toBe(Flash);
  });
});

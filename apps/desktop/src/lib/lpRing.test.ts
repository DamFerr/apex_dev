import { describe, expect, it } from "vitest";
import { apexRing, isApexTier, lpRing, rankTitle } from "./lpRing";

describe("lpRing", () => {
  it("fills the ring with the LP out of 100 below Master", () => {
    expect(lpRing("GOLD", 64)).toMatchObject({ value: 64, apex: false });
    expect(lpRing("EMERALD", 0).value).toBe(0);
  });
  it("clamps a stray value to 0..100", () => {
    expect(lpRing("GOLD", 140).value).toBe(100);
    expect(lpRing("GOLD", -5).value).toBe(0);
  });
  it("shows a full ring, not a progress claim, from Master up whatever the LP", () => {
    for (const t of ["MASTER", "GRANDMASTER", "CHALLENGER"]) {
      expect(lpRing(t, 3604)).toMatchObject({ value: 100, apex: true });
      expect(lpRing(t, 80)).toMatchObject({ value: 100, apex: true });
    }
  });
  it("knows the apex tiers", () => {
    expect(isApexTier("master")).toBe(true);
    expect(isApexTier("DIAMOND")).toBe(false);
  });
});

describe("rankTitle", () => {
  it("drops the division from Master up", () => {
    expect(rankTitle("CHALLENGER", "I")).toBe("Challenger");
    expect(rankTitle("MASTER", "I")).toBe("Master");
  });
  it("keeps it below", () => {
    expect(rankTitle("EMERALD", "II")).toBe("Emerald II");
  });
});

describe("apexRing", () => {
  const cuts = { grandmaster: 400, challenger: 700 };
  it("is the plain LP ring below Master", () => {
    expect(apexRing("GOLD", 64, cuts)).toMatchObject({ value: 64, apex: false, full: false, note: null });
  });
  it("Master: LP out of the Grandmaster cut-off", () => {
    expect(apexRing("MASTER", 100, cuts)).toMatchObject({ value: 25, full: false, note: "300 LP to Grandmaster" });
  });
  it("Grandmaster: from the Grandmaster to the Challenger cut-off", () => {
    expect(apexRing("GRANDMASTER", 550, cuts)).toMatchObject({ value: 50, full: false, note: "150 LP to Challenger" });
  });
  it("is full, with a note, once LP is above the next cut-off (Riot updates the tiers later)", () => {
    expect(apexRing("MASTER", 450, cuts)).toMatchObject({ value: 100, full: false, note: "Above the Grandmaster cut-off (400)" });
    expect(apexRing("GRANDMASTER", 720, cuts)).toMatchObject({ value: 100, note: "Above the Challenger cut-off (700)" });
  });
  it("Challenger is a full ring that says how far from the cut-off", () => {
    expect(apexRing("CHALLENGER", 3604, cuts)).toMatchObject({ value: 100, full: true, note: "2904 LP above the cut-off (700)" });
    expect(apexRing("CHALLENGER", 650, cuts).note).toBe("50 LP below the cut-off (700)");
  });
  it("falls back to the full ring with no note when a cut-off is missing", () => {
    expect(apexRing("MASTER", 100, undefined)).toMatchObject({ value: 100, full: true, note: null });
    expect(apexRing("MASTER", 100, { grandmaster: null, challenger: 700 })).toMatchObject({ full: true, note: null });
    expect(apexRing("GRANDMASTER", 500, { grandmaster: 400, challenger: null })).toMatchObject({ full: true, note: null });
    expect(apexRing("GRANDMASTER", 500, { grandmaster: 700, challenger: 700 }).full).toBe(true);
    expect(apexRing("CHALLENGER", 900, undefined)).toMatchObject({ full: true, note: null });
  });
  it("never leaves 0..100", () => {
    expect(apexRing("GRANDMASTER", 100, cuts).value).toBe(0);
  });
});

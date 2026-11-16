import { describe, expect, it } from "vitest";
import { APEX_TIER_BASE, ladderPoints, ladderTicks, lpStep, pointsLabel } from "./ladder";

describe("ladderPoints", () => {
  it("counts 400 per tier, 100 per division and the LP", () => {
    expect(ladderPoints("IRON", "IV", 0)).toBe(0);
    expect(ladderPoints("IRON", "I", 99)).toBe(399);
    expect(ladderPoints("BRONZE", "IV", 0)).toBe(400);
    expect(ladderPoints("EMERALD", "II", 64)).toBe(5 * 400 + 200 + 64);
    expect(ladderPoints("DIAMOND", "I", 99)).toBe(2799);
  });
  it("puts Master, Grandmaster and Challenger on one LP ladder without divisions", () => {
    expect(ladderPoints("MASTER", "I", 0)).toBe(APEX_TIER_BASE);
    expect(ladderPoints("GRANDMASTER", "I", 150)).toBe(APEX_TIER_BASE + 150);
    expect(ladderPoints("CHALLENGER", "I", 900)).toBe(APEX_TIER_BASE + 900);
  });
  it("is continuous across a promotion and accepts any case", () => {
    expect(ladderPoints("gold", "iv", 100)).toBe(ladderPoints("GOLD", "III", 0));
    expect(ladderPoints("DIAMOND", "I", 100)).toBe(ladderPoints("MASTER", "I", 0));
  });
  it("returns null for an unknown tier or division", () => {
    expect(ladderPoints("WOOD", "I", 0)).toBeNull();
    expect(ladderPoints("GOLD", "V", 0)).toBeNull();
  });
});

describe("pointsLabel", () => {
  it("names the tier, division and LP", () => {
    expect(pointsLabel(2264)).toBe("Emerald II · 64 LP");
    expect(pointsLabel(0)).toBe("Iron IV · 0 LP");
    expect(pointsLabel(1200, false)).toBe("Gold IV");
  });
  it("shows Master and above as one ladder", () => expect(pointsLabel(APEX_TIER_BASE + 120)).toBe("Master+ · 120 LP"));
  it("round-trips with ladderPoints for every division", () => {
    for (const [t, name] of [["GOLD", "Gold"], ["DIAMOND", "Diamond"]] as const) for (const d of ["IV", "III", "II", "I"]) expect(pointsLabel(ladderPoints(t, d, 37)!)).toBe(`${name} ${d} · 37 LP`);
  });
});

describe("lpStep", () => {
  const at = (tier: string, division: string, lp: number, wins: number, losses: number) => ({ tier, division, lp, wins, losses });
  it("reports games and the LP change between two checks", () => {
    expect(lpStep(at("EMERALD", "II", 40, 10, 10), at("EMERALD", "II", 64, 12, 10))).toEqual({ games: 2, wins: 2, losses: 0, lp: 24, reset: false });
    expect(lpStep(at("EMERALD", "II", 64, 12, 10), at("EMERALD", "II", 45, 12, 11)).lp).toBe(-19);
  });
  it("counts a promotion as the real LP gained", () => expect(lpStep(at("EMERALD", "III", 90, 5, 5), at("EMERALD", "II", 12, 6, 5)).lp).toBe(22));
  it("counts a demotion as the real LP lost", () => expect(lpStep(at("EMERALD", "II", 3, 5, 5), at("EMERALD", "III", 80, 5, 6)).lp).toBe(-23));
  it("reports no games when only LP moved (for example decay)", () => expect(lpStep(at("DIAMOND", "I", 50, 5, 5), at("DIAMOND", "I", 25, 5, 5))).toMatchObject({ games: 0, lp: -25 }));
  it("detects a season reset and claims no LP change", () => expect(lpStep(at("GOLD", "I", 80, 150, 140), at("SILVER", "I", 0, 3, 2))).toEqual({ games: 0, wins: 0, losses: 0, lp: null, reset: true }));
  it("gives null LP for an unknown tier instead of a made-up number", () => expect(lpStep(at("WOOD", "I", 0, 1, 1), at("GOLD", "I", 0, 2, 1)).lp).toBeNull());
});

describe("ladderTicks", () => {
  it("returns multiples of 100 covering the range", () => expect(ladderTicks(2230, 2330)).toEqual([2200, 2300, 2400]));
  it("widens the step so a long climb has at most the asked number of ticks", () => {
    const t = ladderTicks(1000, 2800, 5);
    expect(t.length).toBeLessThanOrEqual(6); expect(t[0]).toBeLessThanOrEqual(1000); expect(t[t.length - 1]).toBeGreaterThanOrEqual(2800);
  });
  it("handles a flat history (one value)", () => expect(ladderTicks(2264, 2264)).toEqual([2200, 2300]));
});

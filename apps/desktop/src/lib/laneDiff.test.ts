import { describe, expect, it } from "vitest";
import { fmtLead, isLowLane, laneAt, laneSummary, leadBand } from "./laneDiff";

const d = (minute: 10 | 15 | 20, games: number, gold = 0, cs = 0, xp = 0) => ({ minute, games, gold, cs, xp });

describe("fmtLead", () => {
  it("prints a sign, a real minus, whole gold/XP and one decimal of CS", () => {
    expect(fmtLead("gold", 312.4)).toBe("+312"); expect(fmtLead("gold", -45.6)).toBe("\u221246"); expect(fmtLead("cs", 4.5)).toBe("+4.5"); expect(fmtLead("xp", -120)).toBe("\u2212120");
  });
  it("prints no sign for zero, also for a value that rounds to zero", () => { expect(fmtLead("gold", 0)).toBe("0"); expect(fmtLead("gold", -0.4)).toBe("0"); expect(fmtLead("cs", -0.04)).toBe("0.0"); });
});
describe("leadBand", () => {
  it("is neutral inside the display threshold of each measure and good/bad outside it", () => {
    expect(leadBand("gold", 99)).toBe("neutral"); expect(leadBand("gold", 100)).toBe("good"); expect(leadBand("gold", -100)).toBe("bad");
    expect(leadBand("cs", 1.9)).toBe("neutral"); expect(leadBand("cs", -2)).toBe("bad"); expect(leadBand("xp", 150)).toBe("good");
  });
});
describe("laneAt / isLowLane / laneSummary", () => {
  const lane = [d(10, 3, 200, 4, 100), d(20, 60, -150, -3.2, -80)];
  it("finds a minute or returns undefined", () => { expect(laneAt(lane, 10)?.games).toBe(3); expect(laneAt(lane, 15)).toBeUndefined(); expect(laneAt(undefined, 10)).toBeUndefined(); });
  it("flags fewer than 50 games as low data, as elsewhere in the app", () => { expect(isLowLane(d(10, 49))).toBe(true); expect(isLowLane(d(10, 50))).toBe(false); });
  it("summarises all three measures with the games, the low-data note and the word correlation", () => {
    const s = laneSummary("Lux", lane[0]);
    expect(s).toContain("Lux at 10 min: gold +200, CS +4.0, XP +100"); expect(s).toContain("3 games"); expect(s).toContain("low data"); expect(s).toContain("correlation");
    expect(laneSummary("Lux", lane[1])).not.toContain("low data"); expect(laneSummary("Lux", d(15, 1))).toContain("over 1 game (low data)");
  });
});

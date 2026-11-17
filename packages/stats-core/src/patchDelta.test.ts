import { describe, expect, it } from "vitest";
import { MIN_DELTA_GAMES, patchDelta, shrink, type PatchSample } from "./index";

const s = (games: number, wins: number, bans = 0, matches = 1000): PatchSample => ({ games, wins, bans, matches });

describe("patchDelta win rate", () => {
  it("is the difference of the two shrunk win rates, in percentage points", () => {
    const d = patchDelta(s(1000, 500), s(1000, 540));
    expect(d.winDelta).toBeCloseTo((shrink(540, 1000, 0.5, 50) - shrink(500, 1000, 0.5, 50)) * 100, 9);
    expect(d.winDelta).toBeGreaterThan(3.5);
  });
  it("is null when either patch has fewer than the minimum games", () => {
    expect(patchDelta(s(MIN_DELTA_GAMES - 1, 40), s(1000, 540)).winDelta).toBeNull();
    expect(patchDelta(s(1000, 500), s(MIN_DELTA_GAMES - 1, 40)).winDelta).toBeNull();
    expect(patchDelta(s(MIN_DELTA_GAMES, 25), s(MIN_DELTA_GAMES, 25)).winDelta).toBe(0);
  });
  it("still reports the shrunk win rates and the pick/ban rates when the win-rate change is withheld", () => {
    const d = patchDelta(s(10, 10, 5, 100), s(20, 0, 10, 100));
    expect(d.winDelta).toBeNull(); expect(d.winRange).toBeNull(); expect(d.significant).toBe(false);
    expect(d.prevWinRate).toBeCloseTo(shrink(10, 10, 0.5, 50), 9); // 10/10 is only about 58%, never 100%
    expect(d.prevWinRate).toBeLessThan(0.6);
  });
  it("is exactly 0 for two identical patches", () => {
    const d = patchDelta(s(400, 210), s(400, 210));
    expect(d.winDelta).toBe(0); expect(d.significant).toBe(false);
  });
  it("is antisymmetric: swapping the patches flips the sign and the range", () => {
    const a = patchDelta(s(800, 400), s(600, 330)), b = patchDelta(s(600, 330), s(800, 400));
    expect(a.winDelta!).toBeCloseTo(-b.winDelta!, 9);
    expect(a.winRange![0]).toBeCloseTo(-b.winRange![1], 9);
  });
  it("is significant only when the 95% range excludes 0", () => {
    const noisy = patchDelta(s(100, 50), s(100, 56));   // +6 raw points on 100 games each: well within luck
    expect(noisy.significant).toBe(false); expect(noisy.winRange![0]).toBeLessThan(0);
    const real = patchDelta(s(5000, 2500), s(5000, 2650)); // +3 points on 5000 games each: not luck
    expect(real.significant).toBe(true); expect(real.winRange![0]).toBeGreaterThan(0);
  });
  it("narrows the range as the samples grow", () => {
    const w = (n: number) => { const d = patchDelta(s(n, n / 2), s(n, n / 2)); return d.winRange![1] - d.winRange![0]; };
    expect(w(10_000)).toBeLessThan(w(100));
  });
});

describe("patchDelta pick and ban rate", () => {
  it("are shares of the whole patch, so patches of different size compare fairly", () => {
    const d = patchDelta(s(100, 50, 200, 1000), s(300, 150, 100, 2000)); // 10% -> 15% picked, 20% -> 5% banned
    expect(d.prevPickRate).toBeCloseTo(0.1, 9); expect(d.pickRate).toBeCloseTo(0.15, 9); expect(d.pickDelta).toBeCloseTo(5, 9);
    expect(d.prevBanRate).toBeCloseTo(0.2, 9); expect(d.banRate).toBeCloseTo(0.05, 9); expect(d.banDelta).toBeCloseTo(-15, 9);
  });
  it("are 0 (not NaN) for a patch with no games at all", () => {
    const d = patchDelta(s(0, 0, 0, 0), s(60, 30, 3, 100));
    expect(d.prevPickRate).toBe(0); expect(d.prevBanRate).toBe(0);
    expect(Number.isFinite(d.pickDelta) && Number.isFinite(d.banDelta)).toBe(true);
  });
});

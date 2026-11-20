import { describe, expect, it } from "vitest";
import { lengthCurve, lengthLabel, shrink, wilson } from "./index";

const B = (minSec: number, maxSec: number | null, games: number, wins: number) => ({ minSec, maxSec, games, wins });

describe("lengthLabel", () => {
  it("labels the first, middle and open-ended buckets in minutes", () => {
    expect([lengthLabel(0, 1200), lengthLabel(1200, 1500), lengthLabel(2100, null)]).toEqual(["<20", "20-25", "35+"]);
  });
});

describe("lengthCurve", () => {
  const buckets = [B(0, 1200, 10, 7), B(1200, 1500, 100, 55), B(1500, 1800, 200, 100), B(1800, null, 90, 38)];
  it("uses the champion's overall rate as baseline and shrinks each bucket toward it", () => {
    const c = lengthCurve(buckets), baseline = 200 / 400;
    expect(c.games).toBe(400); expect(c.baseline).toBeCloseTo(baseline, 10);
    expect(c.points[0].winRate).toBeCloseTo(shrink(7, 10, baseline, 20), 10);
    expect(c.points[0].winRate).toBeLessThan(0.7);                       // 7/10 raw, pulled hard toward 50%
    expect(c.points[0].delta).toBeCloseTo(c.points[0].winRate - baseline, 10);
  });
  it("keeps order, labels, Wilson intervals and sample badges", () => {
    const c = lengthCurve(buckets);
    expect(c.points.map((p) => p.label)).toEqual(["<20", "20-25", "25-30", "30+"]);
    expect(c.points[1].ci).toEqual(wilson(55, 100));
    expect(c.points.map((p) => p.badge)).toEqual(["low", "medium", "medium", "medium"]);
  });
  it("handles no games: baseline 50%, zero deltas, low badges, full intervals", () => {
    const c = lengthCurve([B(0, 1200, 0, 0), B(1200, null, 0, 0)]);
    expect(c.baseline).toBe(0.5);
    expect(c.points.every((p) => p.winRate === 0.5 && p.delta === 0 && p.badge === "low" && p.ci[0] === 0 && p.ci[1] === 1)).toBe(true);
  });
  it("returns no points for no buckets", () => expect(lengthCurve([])).toEqual({ games: 0, baseline: 0.5, points: [] }));
});

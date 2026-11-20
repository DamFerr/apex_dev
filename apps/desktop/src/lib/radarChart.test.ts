import { describe, expect, it } from "vitest";
import { formatAxisValue, labelAnchor, radarPath, radarPoint, ringPath, scoreFrac } from "./radarChart";

describe("radarPoint", () => {
  it("puts axis 0 straight up and goes clockwise", () => {
    expect(radarPoint(0, 4, 1, 100, 100, 50)).toEqual([100, 50]);
    expect(radarPoint(1, 4, 1, 100, 100, 50)).toEqual([150, 100]);
    expect(radarPoint(2, 4, 1, 100, 100, 50)).toEqual([100, 150]);
    expect(radarPoint(3, 4, 1, 100, 100, 50)).toEqual([50, 100]);
  });
  it("scales with the fraction and clamps out-of-range or broken values", () => {
    expect(radarPoint(0, 4, 0.5, 100, 100, 50)).toEqual([100, 75]);
    expect(radarPoint(0, 4, 3, 100, 100, 50)).toEqual([100, 50]);
    expect(radarPoint(0, 4, -1, 100, 100, 50)).toEqual([100, 100]);
    expect(radarPoint(0, 4, NaN, 100, 100, 50)).toEqual([100, 100]);
  });
});

describe("radarPath / ringPath", () => {
  it("draws a closed polygon through one point per axis", () => {
    expect(radarPath([1, 1, 1, 1], 100, 100, 50)).toBe("M100 50 L150 100 L100 150 L50 100 Z");
  });
  it("is empty without axes and the ring is a full-score path", () => {
    expect(radarPath([], 0, 0, 10)).toBe("");
    expect(ringPath(4, 1, 100, 100, 50)).toBe(radarPath([1, 1, 1, 1], 100, 100, 50));
  });
});

describe("scoreFrac", () => {
  it("maps 0..100 to 0..1 and clamps", () => { expect([0, 50, 100, 140, -5].map(scoreFrac)).toEqual([0, 0.5, 1, 1, 0]); });
});

describe("labelAnchor", () => {
  it("anchors labels away from the centre", () => { expect([labelAnchor(20, 100), labelAnchor(180, 100), labelAnchor(101, 100)]).toEqual(["end", "start", "middle"]); });
});

describe("formatAxisValue", () => {
  it("rounds damage and gold, keeps one decimal elsewhere", () => {
    expect(formatAxisValue("damage", 812.6)).toBe("813");
    expect(formatAxisValue("economy", 401.2)).toBe("401");
    expect(formatAxisValue("fighting", 3.456)).toBe("3.5");
    expect(formatAxisValue("farming", 7.04)).toBe("7.0");
  });
});

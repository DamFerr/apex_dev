import { describe, expect, it } from "vitest";
import { lengthAxis } from "./lengthAxis";

describe("lengthAxis", () => {
  it("pads the data by one point and always contains the overall rate", () => {
    expect(lengthAxis([46, 52, 55], 50, 6)).toEqual({ lo: 45, hi: 56 });
    expect(lengthAxis([60, 62], 50, 6)).toEqual({ lo: 49, hi: 63 });
  });
  it("never goes narrower than the minimum span (a flat curve is drawn flat)", () => {
    const { lo, hi } = lengthAxis([50.6, 51, 50.9], 50.8, 6);
    expect(hi - lo).toBeCloseTo(6, 10); expect((lo + hi) / 2).toBeCloseTo(50.8, 10);
  });
  it("stays inside 0..100", () => {
    expect(lengthAxis([1, 2], 1.5, 6)).toEqual({ lo: 0, hi: 6 });
    expect(lengthAxis([98, 99], 98.5, 6)).toEqual({ lo: 94, hi: 100 });
  });
});

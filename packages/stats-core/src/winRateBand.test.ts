import { describe, expect, it } from "vitest";
import { winRateBand } from "./winRateBand";

describe("winRateBand", () => {
  it("is bad below 48%, good above 52%, neutral in between", () => {
    expect(winRateBand(0.47)).toBe("bad");
    expect(winRateBand(0.5)).toBe("neutral");
    expect(winRateBand(0.53)).toBe("good");
  });
  it("treats the cut-offs themselves as neutral", () => {
    expect(winRateBand(0.48)).toBe("neutral");
    expect(winRateBand(0.52)).toBe("neutral");
  });
});

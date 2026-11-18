import { describe, expect, it } from "vitest";
import { BAND_MIN, PAIR_PRIOR, PP, STRENGTH_PRIOR, confidenceBand, logit, shrunkEdge, shrunkStrength, sigmoid, toPP } from "./model";

describe("scale", () => {
  it("sigmoid inverts logit", () => expect(sigmoid(logit(0.37))).toBeCloseTo(0.37, 12));
  it("1 log-odds is about PP points near 50%", () => expect((sigmoid(0.01) - 0.5) * 100 / 0.01).toBeCloseTo(PP, 0));
  it("toPP scales linearly", () => expect(toPP(0.2)).toBeCloseTo(0.2 * PP, 12));
});

describe("shrinkage", () => {
  it("a champion with no games is exactly 50%", () => expect(shrunkStrength(0, 0)).toBeCloseTo(0.5, 12));
  it("few games barely move strength, many games approach the raw rate", () => {
    const few = shrunkStrength(8, 10), many = shrunkStrength(8000, 10000);
    expect(few).toBeGreaterThan(0.5); expect(few).toBeLessThan(0.58);
    expect(many).toBeGreaterThan(0.79);
  });
  it("shrunk strength matches (wins + prior/2) / (games + prior)", () => expect(shrunkStrength(30, 50)).toBeCloseTo((30 + STRENGTH_PRIOR / 2) / (50 + STRENGTH_PRIOR), 9));
  it("an edge is 0 with no games and when the pairing performs as predicted", () => {
    expect(shrunkEdge(0, 0, 0.1)).toBeCloseTo(0, 12);
    expect(shrunkEdge(sigmoid(0.1) * 1000, 1000, 0.1)).toBeCloseTo(0, 6);
  });
  it("an edge has the sign of the over/under-performance and grows with games", () => {
    const small = shrunkEdge(7, 10, 0), big = shrunkEdge(700, 1000, 0);
    expect(small).toBeGreaterThan(0); expect(big).toBeGreaterThan(small);
    expect(shrunkEdge(3, 10, 0)).toBeLessThan(0);
  });
  it("is antisymmetric around an even expectation", () => expect(shrunkEdge(30, 100, 0)).toBeCloseTo(-shrunkEdge(70, 100, 0), 9));
  it("the pair prior is lighter than the strength prior", () => expect(PAIR_PRIOR).toBeLessThan(STRENGTH_PRIOR));
});

describe("confidenceBand", () => {
  it("is widest with nothing locked and narrowest with ten picks", () => {
    expect(confidenceBand(0)).toBeCloseTo(0.12, 12);
    expect(confidenceBand(10)).toBeCloseTo(BAND_MIN, 12);
  });
  it("never goes below the minimum", () => expect(confidenceBand(12)).toBeCloseTo(BAND_MIN, 12));
  it("narrows with every extra pick", () => { for (let n = 1; n <= 10; n++) expect(confidenceBand(n)).toBeLessThan(confidenceBand(n - 1)); });
});

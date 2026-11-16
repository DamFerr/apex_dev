import { describe, expect, it } from "vitest";
import { createMockData } from "./fixture";
import { evaluate, recommend, type Pick } from "./index";

const CLASSES = ["Mage", "Marksman", "Tank", "Assassin", "Fighter", "Support"];
const champs = Array.from({ length: 170 }, (_, i) => ({ key: i + 1, tags: [CLASSES[i % 6]] }));
const data = createMockData(champs);
const P = (c: number, role: Pick["role"] = null): Pick => ({ champion: c, role });

describe("evaluate", () => {
  it("is 50% for an empty draft", () => expect(evaluate([], [], data).winProb).toBeCloseTo(0.5, 6));
  it("is antisymmetric: swapping teams gives 1 - p", () => {
    const a = [P(1, "TOP"), P(2, "MID"), P(9, "ADC")], e = [P(4, "TOP"), P(5, "MID"), P(6, "SUPPORT")];
    expect(evaluate(a, e, data).winProb + evaluate(e, a, data).winProb).toBeCloseTo(1, 9);
  });
  it("mock data is antisymmetric for matchups and symmetric for synergy", () => {
    expect(data.matchup(3, 8)).toBeCloseTo(-data.matchup(8, 3), 12);
    expect(data.synergy(3, 8)).toBeCloseTo(data.synergy(8, 3), 12);
  });
  it("penalises a one-sided damage type", () => {
    const mages = [1, 7, 13, 19].map((c) => P(c)); // all Mage
    const f = evaluate(mages, [], data).factors.find((x) => x.label === "Damage balance");
    expect(f && f.z < 0).toBe(true);
  });
  it("uncertainty band narrows as picks lock in", () => {
    const few = evaluate([P(1)], [], data).band, many = evaluate([1, 2, 3, 4, 5].map((c) => P(c)), [6, 7, 8, 9, 10].map((c) => P(c)), data).band;
    expect(many).toBeLessThan(few);
  });
});

describe("recommend", () => {
  const all = champs.map((c) => c.key), ally = [P(2, "JUNGLE"), P(3, "TOP")], enemy = [P(5, "MID")];
  it("returns candidates sorted by win probability for the requested role", () => {
    const r = recommend(ally, enemy, "MID", all, data, { limit: 10 });
    expect(r.length).toBe(10);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].winProb).toBeGreaterThanOrEqual(r[i].winProb);
    expect(r.every((x) => data.roles(x.champion).includes("MID"))).toBe(true);
  });
  it("never suggests excluded (banned or taken) champions", () => {
    const top = recommend(ally, enemy, "MID", all, data)[0].champion;
    expect(recommend(ally, enemy, "MID", all, data, { exclude: new Set([top]) }).some((x) => x.champion === top)).toBe(false);
  });
  it("evaluates a full roster of candidates inside the 150 ms budget", () => {
    const t = performance.now(); recommend([P(1, "TOP"), P(2, "JUNGLE"), P(3, "ADC")], [P(4, "TOP"), P(5, "MID"), P(6, "SUPPORT")], "MID", all, data);
    expect(performance.now() - t).toBeLessThan(150);
  });
});

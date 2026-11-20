import { describe, expect, it } from "vitest";
import { SCALING_MAX, SCALING_WEIGHT, compPenalties, compTerms, evaluate, guessRoles, matchupTerms, recommend, scalingTerms, strengthTerm, synergyTerms, type DraftData, type Pick } from "./index";

/** Deterministic test fixture (not shipped): class-vs-class edges plus hash noise, so the engine has structure to work on. */
function rand(seed: number) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const EDGE: Record<string, Record<string, number>> = {
  Assassin: { Mage: 0.08, Marksman: 0.06, Fighter: -0.06 }, Fighter: { Assassin: 0.06, Tank: -0.04, Mage: 0.03 },
  Mage: { Assassin: -0.08, Fighter: -0.03, Tank: 0.05 }, Tank: { Mage: -0.05, Marksman: 0.04 }, Marksman: { Tank: -0.04, Assassin: -0.06 },
};
const SYN: Record<string, number> = { "Marksman+Support": 0.06, "Mage+Tank": 0.03, "Assassin+Support": 0.02, "Fighter+Support": 0.02 };
function fixtureData(champs: { key: number; tags: string[] }[]): DraftData {
  const tagMap = new Map(champs.map((c) => [c.key, c.tags])), t0 = (k: number) => tagMap.get(k)?.[0] ?? "";
  const noise = (a: number, b: number) => rand(Math.min(a, b) * 100003 + Math.max(a, b))();
  return {
    strength: (c) => 0.46 + rand(c)() * 0.08, tags: (c) => tagMap.get(c) ?? [], roles: (c) => guessRoles(tagMap.get(c) ?? []),
    matchup: (a, b) => (EDGE[t0(a)]?.[t0(b)] ?? 0) - (EDGE[t0(b)]?.[t0(a)] ?? 0) + (a < b ? 1 : -1) * (noise(a, b) * 0.08 - 0.04),
    synergy: (a, b) => (SYN[[t0(a), t0(b)].sort().join("+")] ?? 0) + (noise(a + 7, b + 7) * 0.06 - 0.03),
  };
}

const CLASSES = ["Mage", "Marksman", "Tank", "Assassin", "Fighter", "Support"];
const champs = Array.from({ length: 170 }, (_, i) => ({ key: i + 1, tags: [CLASSES[i % 6]] }));
const data = fixtureData(champs);
const P = (c: number, role: Pick["role"] = null): Pick => ({ champion: c, role });

describe("evaluate", () => {
  it("is 50% for an empty draft", () => expect(evaluate([], [], data).winProb).toBeCloseTo(0.5, 6));
  it("is antisymmetric: swapping teams gives 1 - p", () => {
    const a = [P(1, "TOP"), P(2, "MID"), P(9, "ADC")], e = [P(4, "TOP"), P(5, "MID"), P(6, "SUPPORT")];
    expect(evaluate(a, e, data).winProb + evaluate(e, a, data).winProb).toBeCloseTo(1, 9);
  });
  it("test data is antisymmetric for matchups and symmetric for synergy", () => {
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

describe("layers", () => {
  const A = [P(1, "TOP"), P(2, "MID"), P(9, "ADC")], E = [P(4, "TOP"), P(5, "MID"), P(6, "SUPPORT")];
  const z = (t: { z: number }[]) => t.reduce((s, x) => s + x.z, 0);
  it("each layer is antisymmetric: swapping the teams flips its sum", () => {
    for (const layer of [strengthTerm, matchupTerms, synergyTerms, compTerms]) expect(z(layer(A, E, data))).toBeCloseTo(-z(layer(E, A, data)), 9);
  });
  it("matchups only pair players in the same role", () => {
    const m = matchupTerms(A, E, data);
    expect(m.map((t) => t.champs)).toEqual([[1, 4], [2, 5]]);
  });
  it("synergies cover every pair inside both teams", () => expect(synergyTerms(A, E, data).length).toBe(3 + 3));
  it("evaluate's factors are exactly the non-zero layer terms and sum to the logit", () => {
    const ev = evaluate(A, E, data), all = [...strengthTerm(A, E, data), ...matchupTerms(A, E, data), ...synergyTerms(A, E, data), ...compTerms(A, E, data)];
    expect(ev.factors.reduce((s, f) => s + f.z, 0)).toBeCloseTo(z(all), 9);
    expect(ev.factors.every((f) => Math.abs(f.pp - f.z * 25) < 1e-9)).toBe(true);
  });
  it("comp penalties are never positive and skip small teams", () => {
    expect(Object.values(compPenalties([P(1), P(7), P(13), P(19)], data)).every((v) => v <= 0)).toBe(true);
    expect(compPenalties([P(1), P(7)], data)).toEqual({ "Damage balance": 0, Frontline: 0, "Crowd control": 0 });
  });
  it("uses the shared band function", () => expect(evaluate(A, E, data).band).toBeCloseTo(0.02 + (0.1 * 4) / 10, 12));
});

describe("scaling term (E.2d)", () => {
  // Champions 1..3 scale late (+0.02), 4..6 early (-0.02), everything else has no measured score. (Differences of 0.04 x 1.5 stay under the cap.)
  const score = (c: number) => (c >= 1 && c <= 3 ? 0.02 : c >= 4 && c <= 6 ? -0.02 : null);
  const withScaling: DraftData = { ...data, scaling: (c) => { const s = score(c); return s === null ? null : { score: s, games: 100 }; } };
  const late = [P(1, "TOP"), P(2, "MID"), P(3, "ADC")], early = [P(4, "TOP"), P(5, "MID"), P(6, "ADC")];
  it("is absent when the data has no scaling", () => { expect(scalingTerms(late, early, data)).toEqual([]); expect(evaluate(late, early, data).factors.some((f) => f.label === "Scaling")).toBe(false); });
  it("favours the team that scales better, by the weighted difference of the team means", () => {
    const z = scalingTerms(late, early, withScaling)[0].z;
    expect(z).toBeCloseTo(SCALING_WEIGHT * 0.04, 12); // mean +0.02 minus mean -0.02
    expect(z).toBeGreaterThan(0);
  });
  it("is antisymmetric and the win probabilities of the two sides still add to 1", () => {
    expect(scalingTerms(early, late, withScaling)[0].z).toBeCloseTo(-scalingTerms(late, early, withScaling)[0].z, 12);
    expect(evaluate(late, early, withScaling).winProb + evaluate(early, late, withScaling).winProb).toBeCloseTo(1, 9);
  });
  it("is capped at SCALING_MAX in both directions", () => {
    const extreme: DraftData = { ...data, scaling: (c) => ({ score: c <= 3 ? 0.4 : -0.4, games: 100 }) };
    expect(scalingTerms(late, early, extreme)[0].z).toBe(SCALING_MAX);
    expect(scalingTerms(early, late, extreme)[0].z).toBe(-SCALING_MAX);
  });
  it("counts a pick without a measured score as neutral (the team mean is over all picks)", () => {
    const half = scalingTerms([P(1, "TOP"), P(10, "MID")], [P(11, "TOP"), P(12, "MID")], withScaling)[0].z;
    expect(half).toBeCloseTo(SCALING_WEIGHT * 0.01, 12); // 0.02 / 2 picks, enemy has none
  });
  it("adds nothing when neither team has a measured pick, and shows up as a factor otherwise", () => {
    expect(evaluate([P(10, "TOP")], [P(11, "TOP")], withScaling).factors.some((f) => f.label === "Scaling")).toBe(false);
    const f = evaluate(late, early, withScaling).factors.find((x) => x.label === "Scaling");
    expect(f?.kind).toBe("comp"); expect(f!.pp).toBeGreaterThan(0); expect(Math.abs(f!.pp)).toBeLessThanOrEqual(SCALING_MAX * 25 + 1e-9);
  });
});

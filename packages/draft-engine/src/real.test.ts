import { describe, expect, it } from "vitest";
import { createRealData, evaluate, logit, type DraftStats } from "./index";

const keys = new Map([["Ahri", 1], ["Jinx", 2], ["Lux", 3], ["Zed", 4]]), tags = () => ["Mage"];
const champs = (over: Partial<Record<string, [number, number]>> = {}) => (["Ahri", "Jinx", "Lux", "Zed"] as const).map((id) => ({ id, games: over[id]?.[0] ?? 100, wins: over[id]?.[1] ?? 50, roles: ["MID"] }));
const stats = (s: Partial<DraftStats> = {}): DraftStats => ({ games: 100, champions: champs(), matchups: [], synergies: [], ...s });

describe("createRealData: strength", () => {
  it("shrinks a champion's win rate toward 50%", () => expect(createRealData(stats({ champions: champs({ Ahri: [100, 60] }) }), keys, tags).strength(1)).toBeCloseTo(85 / 150, 6));
  it("trusts 3 wins in 3 games far less than 300 in 300", () => {
    const small = createRealData(stats({ champions: champs({ Ahri: [3, 3] }) }), keys, tags).strength(1), big = createRealData(stats({ champions: champs({ Ahri: [300, 300] }) }), keys, tags).strength(1);
    expect(small).toBeLessThan(0.6); expect(big).toBeGreaterThan(0.85);
  });
  it("is neutral for champions with no data and never returns 0 or 1", () => {
    const d = createRealData(stats({ champions: champs({ Ahri: [5, 5] }) }), keys, tags);
    expect(d.strength(99)).toBe(0.5); expect(d.strength(1)).toBeLessThan(1);
  });
});

describe("createRealData: pair effects", () => {
  it("lane matchups are antisymmetric and positive when a champion beats the opponent more than expected", () => {
    const d = createRealData(stats({ matchups: [["Ahri", "Lux", 100, 70]] }), keys, tags);
    expect(d.matchup(1, 3)).toBeGreaterThan(0);
    expect(d.matchup(3, 1)).toBeCloseTo(-d.matchup(1, 3), 12);
  });
  it("measures matchups against what the strengths predict, so an expected result has no edge", () => {
    const strong = champs({ Ahri: [100, 65] });                              // Ahri is simply a strong champion
    const pExpected = 90 / 150, d = createRealData(stats({ champions: strong, matchups: [["Ahri", "Lux", 100, Math.round(pExpected * 100)]] }), keys, tags);
    expect(Math.abs(d.matchup(1, 3))).toBeLessThan(0.02);                    // Ahri winning 60% was already priced in by her strength
  });
  it("a pairing seen a few times barely moves the result compared with one seen many times", () => {
    const few = createRealData(stats({ matchups: [["Ahri", "Lux", 3, 3]] }), keys, tags).matchup(1, 3), many = createRealData(stats({ matchups: [["Ahri", "Lux", 300, 210]] }), keys, tags).matchup(1, 3);
    expect(few).toBeLessThan(many); expect(few).toBeLessThan(logit(0.6));
  });
  it("synergy is symmetric and positive for pairs that win more than their strengths predict", () => {
    const d = createRealData(stats({ synergies: [["Ahri", "Jinx", 100, 65]] }), keys, tags);
    expect(d.synergy(1, 2)).toBeGreaterThan(0); expect(d.synergy(2, 1)).toBeCloseTo(d.synergy(1, 2), 12);
  });
  it("unknown pairs and unknown champions contribute nothing", () => {
    const d = createRealData(stats(), keys, tags);
    expect([d.matchup(1, 3), d.synergy(1, 2), d.matchup(1, 99), d.synergy(99, 1)]).toEqual([0, 0, 0, 0]);
  });
});

describe("createRealData: roles and the engine", () => {
  it("uses collected roles, and falls back to guessing from class tags", () => {
    const d = createRealData(stats({ champions: [{ id: "Ahri", games: 10, wins: 5, roles: ["TOP"] }, { id: "Jinx", games: 10, wins: 5, roles: [] }] }), keys, (k) => (k === 2 ? ["Marksman"] : ["Mage"]));
    expect(d.roles(1)).toEqual(["TOP"]); expect(d.roles(2)).toEqual(["ADC"]);
  });
  it("feeds the win probability: a good collected synergy raises it, a bad one lowers it, and the engine stays antisymmetric", () => {
    const ally = [{ champion: 1, role: "MID" as const }, { champion: 2, role: "ADC" as const }], enemy = [{ champion: 3, role: "MID" as const }];
    const plain = evaluate(ally, enemy, createRealData(stats(), keys, tags)).winProb;
    const good = evaluate(ally, enemy, createRealData(stats({ synergies: [["Ahri", "Jinx", 200, 140]] }), keys, tags)).winProb;
    const bad = evaluate(ally, enemy, createRealData(stats({ synergies: [["Ahri", "Jinx", 200, 60]] }), keys, tags)).winProb;
    expect(good).toBeGreaterThan(plain); expect(bad).toBeLessThan(plain);
    const d = createRealData(stats({ matchups: [["Ahri", "Lux", 100, 70]], synergies: [["Ahri", "Jinx", 100, 65]] }), keys, tags);
    expect(evaluate(ally, enemy, d).winProb + evaluate(enemy, ally, d).winProb).toBeCloseTo(1, 9);
  });
});

describe("createRealData: profiles", () => {
  it("exposes collected damage numbers by champion key and nothing for unknown champions", () => {
    const row = { id: "Ahri", games: 30, phys: 1, magic: 2, trueDmg: 3, taken: 4, cc: 5, seconds: 6 };
    const d = createRealData(stats({ profiles: [row] }), keys, tags);
    expect(d.profile?.(1)).toEqual(row); expect(d.profile?.(2)).toBeNull(); expect(d.profile?.(99)).toBeNull();
  });
  it("works with a backend that sends no profiles at all", () => expect(createRealData(stats(), keys, tags).profile?.(1)).toBeNull());
});

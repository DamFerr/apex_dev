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

describe("createRealData: games", () => {
  it("counts the role's games when the role has some, else the champion's total, 0 for an unknown champion", () => {
    const d = createRealData(stats({ champions: champs({ Ahri: [100, 50] }), roleChampions: [{ id: "Ahri", role: "MID", games: 12, wins: 6 }] }), keys, tags);
    expect(d.games!(1, "MID")).toBe(12); expect(d.games!(1, "TOP")).toBe(100); expect(d.games!(1)).toBe(100); expect(d.games!(99, "MID")).toBe(0);
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
    expect(d.profile?.(1)).toEqual({ games: 30, phys: 1, magic: 2, trueDmg: 3, taken: 4, cc: 5, seconds: 6 }); expect(d.profile?.(2)).toBeNull(); expect(d.profile?.(99)).toBeNull();
  });
  it("works with a backend that sends no profiles at all", () => expect(createRealData(stats(), keys, tags).profile?.(1)).toBeNull());
});

describe("createRealData: baseline", () => {
  it("is null with few games and a value with enough", () => {
    const row = (games: number) => ({ id: "A", games, phys: 1, magic: 1, trueDmg: 0, taken: 600 * games * 30, cc: 60 * games * 30, seconds: 1800 * games });
    expect(createRealData(stats({ profiles: [row(10)] }), keys, tags).baseline?.()).toBeNull();
    expect(createRealData(stats({ profiles: [row(300)] }), keys, tags).baseline?.()?.takenPerMin).toBeCloseTo(600, 6);
    expect(createRealData(stats(), keys, tags).baseline?.()).toBeNull();
  });
});

describe("createRealData: per-role profiles", () => {
  const mk = (id: string, role: string | undefined, games: number, phys: number) => ({ id, ...(role ? { role } : {}), games, phys, magic: 0, trueDmg: 0, taken: games * 100, cc: games, seconds: games * 1800 });
  const d = createRealData(stats({ profiles: [mk("Ahri", "MID", 40, 4000), mk("Ahri", "SUPPORT", 30, 300), mk("Ahri", "TOP", 5, 50)] }), keys, tags);
  it("returns the role's own numbers when it has enough games", () => {
    expect(d.profile?.(1, "MID")).toMatchObject({ games: 40, phys: 4000 }); expect(d.profile?.(1, "SUPPORT")).toMatchObject({ games: 30, phys: 300 });
  });
  it("falls back to the total over all roles for a thin or unseen role, or no role", () => {
    const all = { games: 75, phys: 4350 };
    expect(d.profile?.(1, "TOP")).toMatchObject(all); expect(d.profile?.(1, "ADC")).toMatchObject(all); expect(d.profile?.(1)).toMatchObject(all); expect(d.profile?.(1, null)).toMatchObject(all);
  });
  it("treats rows without a role (older backends) as all roles", () => {
    const old = createRealData(stats({ profiles: [mk("Ahri", undefined, 50, 5000)] }), keys, tags);
    expect(old.profile?.(1, "MID")).toMatchObject({ games: 50 }); expect(old.profile?.(1)).toMatchObject({ games: 50 });
  });
  it("does not double count the baseline (role rows are summed once)", () => {
    expect(d.baseline?.()).toBeNull();   // 75 games < 200
    const big = createRealData(stats({ profiles: [mk("Ahri", "MID", 300, 1), mk("Ahri", "TOP", 300, 1)] }), keys, tags);
    expect(big.baseline?.()?.takenPerMin).toBeCloseTo((100 * 60) / 1800, 6);
  });
});

describe("createRealData: role-keyed statistics (H.2)", () => {
  const roleStats = (s: Partial<DraftStats> = {}) => stats({
    champions: champs({ Ahri: [200, 100], Lux: [200, 100] }),
    roleChampions: [{ id: "Ahri", role: "TOP", games: 100, wins: 40 }, { id: "Ahri", role: "JUNGLE", games: 100, wins: 60 }],
    ...s,
  });
  it("a champion's strength differs per role and is shrunk toward its overall rate", () => {
    const d = createRealData(roleStats(), keys, tags);
    expect(d.strength(1, "JUNGLE")).toBeGreaterThan(d.strength(1)); expect(d.strength(1, "TOP")).toBeLessThan(d.strength(1));
    expect(d.strength(1, "JUNGLE")).toBeLessThan(0.6);                        // 60% in 100 games is shrunk, never taken at face value
  });
  it("a role with no games gives the overall rate; no role gives the overall rate; old data (no roleChampions) is unchanged", () => {
    const d = createRealData(roleStats(), keys, tags);
    expect(d.strength(1, "SUPPORT")).toBeCloseTo(d.strength(1), 12); expect(d.strength(1, null)).toBeCloseTo(d.strength(1), 12);
    const old = createRealData(stats({ champions: champs({ Ahri: [100, 60] }) }), keys, tags);
    expect(old.strength(1, "TOP")).toBeCloseTo(85 / 150, 6);
  });
  it("a role's matchup uses only that role's games: top-lane games never feed a jungle number", () => {
    const d = createRealData(roleStats({ matchups: [["Ahri", "Lux", 100, 70]], roleMatchups: [["Ahri", "Lux", "TOP", 100, 70]] }), keys, tags);
    expect(d.matchup(1, 3, "TOP")).toBeGreaterThan(0.1);
    expect(d.matchup(1, 3, "JUNGLE")).toBe(0);                                // the pair was only ever seen in top
    expect(d.matchup(1, 3)).toBeGreaterThan(0.1);                             // no role: role-less pair
  });
  it("role matchups stay antisymmetric and fall back to role-less pairs on old data", () => {
    const d = createRealData(roleStats({ roleMatchups: [["Ahri", "Lux", "TOP", 100, 70]] }), keys, tags);
    expect(d.matchup(3, 1, "TOP")).toBeCloseTo(-d.matchup(1, 3, "TOP"), 12);
    const old = createRealData(stats({ matchups: [["Ahri", "Lux", 100, 70]] }), keys, tags);
    expect(old.matchup(1, 3, "JUNGLE")).toBeGreaterThan(0.1);                  // no roleMatchups from the backend: old behaviour
  });
  it("the engine looks the lane up by role: same pair, top vs jungle", () => {
    const d = createRealData(roleStats({ roleMatchups: [["Ahri", "Lux", "TOP", 100, 70]] }), keys, tags);
    const run = (role: "TOP" | "JUNGLE") => evaluate([{ champion: 1, role }], [{ champion: 3, role }], d).factors.some((f) => f.kind === "matchup" && f.z !== 0);
    expect(run("TOP")).toBe(true); expect(run("JUNGLE")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { MIN_PROFILE_GAMES, damageSkew, evaluate, profileBaseline, shortfall, teamComp, type CompProfile, type DraftData } from "./index";

// One game of 30 minutes = 1800 s, so a champion with 18000 physical damage per game does 600 per minute.
const prof = (phys: number, magic: number, trueDmg = 0, over: Partial<CompProfile> = {}): CompProfile => ({ games: 50, phys: phys * 50, magic: magic * 50, trueDmg: trueDmg * 50, taken: 20000 * 50, cc: 30 * 50, seconds: 1800 * 50, ...over });
const none = () => [] as string[];
const picks = (...c: number[]) => c.map((champion) => ({ champion, role: null }));

describe("teamComp: measured", () => {
  it("weights champions by how much damage they actually deal", () => {
    // a 20000-damage physical carry and a 5000-damage magic support: the team is 80% physical, not 50/50
    const p = new Map([[1, prof(20000, 0)], [2, prof(0, 5000)]]);
    const c = teamComp(picks(1, 2), (k) => p.get(k), none);
    expect(c.measured).toBe(true);
    expect(c.ad).toBeCloseTo(0.8, 9); expect(c.ap).toBeCloseTo(0.2, 9); expect(c.trueShare).toBe(0);
  });
  it("shares always add up to 1, true damage included", () => {
    const p = new Map([[1, prof(9000, 6000, 1000)], [2, prof(2000, 12000, 500)]]);
    const c = teamComp(picks(1, 2), (k) => p.get(k), none);
    expect(c.ad + c.ap + c.trueShare).toBeCloseTo(1, 12);
    expect(c.trueShare).toBeCloseTo(1500 / 30500, 9);
  });
  it("sums damage taken and CC per minute over the team", () => {
    const p = new Map([[1, prof(1000, 0)], [2, prof(1000, 0)]]);
    const c = teamComp(picks(1, 2), (k) => p.get(k), none);
    expect(c.takenPerMin).toBeCloseTo(2 * (20000 / 30), 6);   // 20000 taken in 30 min, two champions
    expect(c.ccPerMin).toBeCloseTo(2 * (30 / 30), 6);
  });
  it("a champion that never deals damage of one type does not break the split", () => {
    const c = teamComp(picks(1), () => prof(0, 8000), none);
    expect(c.ap).toBe(1); expect(c.ad).toBe(0);
  });
});

describe("teamComp: fallback to class tags", () => {
  const tags = (k: number) => (k === 1 ? ["Mage"] : k === 2 ? ["Support"] : ["Marksman"]);
  it("is used when any pick lacks enough games, and says so", () => {
    const p = new Map([[1, prof(0, 9000)], [2, prof(0, 3000, 0, { games: MIN_PROFILE_GAMES - 1 })]]);
    const c = teamComp(picks(1, 2, 3), (k) => p.get(k), tags);
    expect(c.measured).toBe(false); expect(c.measuredPicks).toBe(1);
    expect(c.ap).toBeCloseTo(2 / 3, 9); expect(c.ad).toBeCloseTo(1 / 3, 9);
    expect(c.takenPerMin).toBeNull(); expect(c.ccPerMin).toBeNull();   // never invented from tags
  });
  it("accepts exactly MIN_PROFILE_GAMES", () => {
    expect(teamComp(picks(1), () => prof(0, 9000, 0, { games: MIN_PROFILE_GAMES }), none).measured).toBe(true);
  });
  it("ignores a profile with no playing time (division by zero guard)", () => {
    expect(teamComp(picks(1), () => prof(100, 0, 0, { seconds: 0 }), tags).measured).toBe(false);
  });
  it("an empty team has no damage and is not measured", () => {
    const c = teamComp([], () => null, none);
    expect(c).toMatchObject({ picks: 0, measured: false, ad: 0, ap: 0 }); expect(damageSkew(c)).toBe(0);
  });
});

describe("layer B uses the measured split", () => {
  const base = (profile?: (c: number) => CompProfile | null): DraftData => ({
    strength: () => 0.5, matchup: () => 0, synergy: () => 0, tags: () => ["Fighter"], roles: () => ["TOP"], profile,
  });
  const ally = [1, 2, 3].map((champion) => ({ champion, role: null })), enemy = [4, 5, 6].map((champion) => ({ champion, role: null }));
  it("penalises a team that is almost all one damage type, even when class tags look balanced", () => {
    const allPhysical = (c: number) => (c <= 3 ? prof(15000, 500) : prof(9000, 8000));
    const ev = evaluate(ally, enemy, base(allPhysical));
    expect(ev.winProb).toBeLessThan(0.5);
    expect(ev.factors.find((f) => f.label === "Damage balance")?.z).toBeLessThan(0);
  });
  it("gives the same answer as before when no profiles exist (class tag rule)", () => {
    expect(evaluate(ally, enemy, base()).winProb).toBe(0.5);
  });
  it("stays antisymmetric: swapping the teams mirrors the probability", () => {
    const d = base((c) => (c <= 3 ? prof(15000, 500) : prof(9000, 8000)));
    expect(evaluate(ally, enemy, d).winProb + evaluate(enemy, ally, d).winProb).toBeCloseTo(1, 12);
  });
});

describe("shortfall and baseline", () => {
  it("is 0 at 80% of expected or more, 1 at 40% or less, linear between", () => {
    expect(shortfall(100, 100)).toBe(0); expect(shortfall(80, 100)).toBeCloseTo(0, 9); expect(shortfall(60, 100)).toBeCloseTo(0.5, 9);
    expect(shortfall(40, 100)).toBe(1); expect(shortfall(0, 100)).toBe(1);
  });
  it("is 0 without a usable expected value", () => { expect(shortfall(5, 0)).toBe(0); expect(shortfall(NaN, 10)).toBe(0); });
  it("averages damage taken and CC per minute over all games, weighted by time played", () => {
    // 100 games of 1800 s at 30000 taken / 3000 cc, plus 100 games of 1800 s at 10000 / 1000: 20000 and 2000 per game = 666.7 and 66.7 per minute
    const b = profileBaseline([prof(0, 0, 0, { games: 100, seconds: 180000, taken: 3000000, cc: 300000 }), prof(0, 0, 0, { games: 100, seconds: 180000, taken: 1000000, cc: 100000 })])!;
    expect(b.takenPerMin).toBeCloseTo(666.67, 1); expect(b.ccPerMin).toBeCloseTo(66.67, 1);
  });
  it("is null with too few games or no time", () => {
    expect(profileBaseline([prof(0, 0, 0, { games: 50 })])).toBeNull(); expect(profileBaseline([])).toBeNull();
  });
});

describe("layer B measures Frontline and Crowd control", () => {
  const baseline = { takenPerMin: 600, ccPerMin: 60 };
  // ally champs 1-4 are squishy (200 taken/min, 10 cc/min) but TAGGED Tank; enemy 5-8 are normal (600 / 60)
  const prof2 = (taken: number, cc: number) => prof(10000, 0, 0, { taken: taken * 30 * 50, cc: cc * 30 * 50 }); // 1800 s games: per minute x 30
  const profile = (c: number) => (c <= 4 ? prof2(200, 10) : prof2(600, 60));
  const mk = (withBaseline: boolean): DraftData => ({ strength: () => 0.5, matchup: () => 0, synergy: () => 0, tags: (c) => (c <= 4 ? ["Tank"] : ["Mage"]), roles: () => ["TOP"], profile, baseline: withBaseline ? () => baseline : undefined });
  const A = [1, 2, 3, 4].map((champion) => ({ champion, role: null })), E = [5, 6, 7, 8].map((champion) => ({ champion, role: null }));
  const term = (d: DraftData, k: string) => evaluate(A, E, d).factors.find((f) => f.label === k)?.z;
  it("penalises a team that is Tank-tagged but measured squishy, which the tag rule cannot see", () => {
    expect(term(mk(true), "Frontline")).toBeLessThan(0);
    expect(term(mk(true), "Crowd control")).toBeLessThan(0);
  });
  it("never exceeds the old tag penalties (-0.15 and -0.1 per team)", () => {
    expect(term(mk(true), "Frontline")!).toBeGreaterThanOrEqual(-0.15 - 1e-9); expect(term(mk(true), "Crowd control")!).toBeGreaterThanOrEqual(-0.1 - 1e-9);
  });
  it("keeps the class-tag rule when there is no baseline, so the answer is unchanged", () => {
    expect(term(mk(false), "Frontline")).toBeGreaterThan(0);   // enemy Mage-only team has no Tank/Fighter: it is the enemy that is penalised
  });
  it("stays antisymmetric", () => { const d = mk(true); expect(evaluate(A, E, d).winProb + evaluate(E, A, d).winProb).toBeCloseTo(1, 12); });
  it("does not apply below four picks", () => expect(evaluate(A.slice(0, 3), E.slice(0, 3), mk(true)).factors.find((f) => f.label === "Frontline")).toBeUndefined());
});

describe("teamComp passes the pick's role to the profile lookup", () => {
  it("lets one champion count differently by role (a mid carry vs the same champion as support)", () => {
    const byRole = (c: number, r: string | null) => (r === "SUPPORT" ? prof(2000, 0) : prof(20000, 0));
    const mid = teamComp([{ champion: 1, role: "MID" }], byRole, none), sup = teamComp([{ champion: 1, role: "SUPPORT" }], byRole, none);
    expect(mid.measured && sup.measured).toBe(true);
    expect(mid.takenPerMin).toBe(sup.takenPerMin);                       // same taken in this fixture; the damage split is what differs
    const mixed = teamComp([{ champion: 1, role: "MID" }, { champion: 1, role: "SUPPORT" }], byRole, none);
    expect(mixed.ad).toBe(1);
  });
  it("calls the lookup with a null role when the pick has none", () => {
    const seen: (string | null)[] = []; teamComp([{ champion: 1, role: null }], (c, r) => { seen.push(r); return prof(1, 1); }, none);
    expect(seen).toEqual([null]);
  });
});

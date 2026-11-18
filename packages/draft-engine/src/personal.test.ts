import { describe, expect, it } from "vitest";
import { MASTERY_MAX_Z, MASTERY_WEIGHT } from "./model";
import { evaluate, familiarity, logit, poolForRole, poolNote, poolZ, recommend, recommendBans, personalZ, type DraftData } from "./index";

describe("personalZ", () => {
  it("is 0 with no games", () => expect(personalZ(0.5, 0, 0)).toBe(0));
  it("rewards a strong record and punishes a weak one", () => { expect(personalZ(0.5, 16, 20)).toBeGreaterThan(0); expect(personalZ(0.5, 4, 20)).toBeLessThan(0); });
  it("trusts 100 games more than 3 games", () => expect(personalZ(0.5, 70, 100)).toBeGreaterThan(personalZ(0.5, 3, 3)));
  it("shrinks 3/3 to a modest effect, never an extreme one", () => expect(personalZ(0.5, 3, 3)).toBeLessThan(logit(0.75)));
});

// A tiny hand-made world: champion 99 crushes champion 1 (which you play a lot); everything else is neutral.
const world: DraftData = {
  strength: () => 0.5, tags: () => [], roles: () => ["MID"], synergy: () => 0,
  matchup: (a, b) => (a === 99 && b === 1 ? 0.5 : a === 1 && b === 99 ? -0.5 : 0),
};
describe("recommendBans", () => {
  const cands = [1, 2, 3, 99];
  it("bans what beats your most played champion, and says who it beats", () => {
    const r = recommendBans("MID", cands, world, [{ champion: 1, games: 40 }, { champion: 2, games: 2 }]);
    expect(r[0].champion).toBe(99);
    expect(r[0].against).toBe(1);
  });
  it("respects role, exclusions and the limit", () => {
    expect(recommendBans("TOP", cands, world, []).length).toBe(0);
    expect(recommendBans("MID", cands, world, [], { exclude: new Set([99]) }).some((b) => b.champion === 99)).toBe(false);
    expect(recommendBans("MID", cands, world, [], { limit: 2 }).length).toBe(2);
  });
});
describe("recommend with personalization", () => {
  it("ranks a champion you play well above an otherwise identical one", () => {
    const r = recommend([], [], "MID", [2, 3], world, { personal: (c) => (c === 3 ? { z: 0.2, note: "You: 70% in 30 games" } : null) });
    expect(r[0].champion).toBe(3);
    expect(r[0].note).toContain("70%");
    expect(r[0].why?.kind).toBe("personal");
    expect(evaluate([], [], world).winProb).toBeCloseTo(0.5, 6);
  });
});

describe("pool for a role", () => {
  const pool = [
    { champion: 1, points: 300_000, byRole: { TOP: { games: 8, wins: 5 } } },                         // Irelia: only ever played top
    { champion: 2, points: 150_000, byRole: { JUNGLE: { games: 4, wins: 3 }, TOP: { games: 1, wins: 0 } } },
    { champion: 3, points: 90_000, byRole: {} },                                                      // mastery only, roles unknown
    { champion: 4, points: 50_000, byRole: {} },
  ];
  const rolesOf = (c: number) => (c === 3 ? ["JUNGLE" as const] : ["MID" as const]);
  it("leaves out champions you only play in another role", () => {
    const j = poolForRole(pool, "JUNGLE", rolesOf).map((p) => p.champion);
    expect(j).not.toContain(1);                                       // top-lane Irelia says nothing about a jungle game
    expect(poolForRole(pool, "TOP", rolesOf).map((p) => p.champion)).toEqual([1, 2]);
  });
  it("counts only the games played in that role", () => expect(poolForRole(pool, "JUNGLE", rolesOf).find((p) => p.champion === 2)).toEqual({ champion: 2, points: 150_000, games: 4, wins: 3 }));
  it("keeps mastery-only champions when the collected games show them in the role, and drops them otherwise", () => {
    const j = poolForRole(pool, "JUNGLE", rolesOf);
    expect(j.find((p) => p.champion === 3)).toEqual({ champion: 3, points: 90_000, games: 0, wins: 0 });
    expect(j.some((p) => p.champion === 4)).toBe(false);
  });
});

describe("mastery outweighs recent games", () => {
  it("familiarity: 300k mastery with no recent games beats no mastery with 20 recent games", () => expect(familiarity(300_000, 0)).toBeGreaterThan(familiarity(0, 20)));
  it("familiarity is 0 with nothing, grows with both, stays below 1", () => {
    expect(familiarity(0, 0)).toBe(0); expect(familiarity(200_000, 0)).toBeGreaterThan(familiarity(100_000, 0)); expect(familiarity(200_000, 10)).toBeGreaterThan(familiarity(200_000, 0));
    expect(familiarity(5_000_000, 500)).toBeLessThan(1);
  });
  it("poolZ: mastery moves the bonus more than a good recent record", () => {
    const mastery = poolZ(0.5, { champion: 1, points: 400_000, games: 0, wins: 0 }), form = poolZ(0.5, { champion: 1, points: 0, games: 20, wins: 16 });
    expect(mastery).toBeGreaterThan(form); expect(form).toBeGreaterThan(0);
  });
  it("poolZ is 0 without data, capped by the mastery bonus, and negative for a bad record without mastery", () => {
    expect(poolZ(0.5, { champion: 1, points: 0, games: 0, wins: 0 })).toBe(0);
    expect(poolZ(0.5, { champion: 1, points: 50_000_000, games: 0, wins: 0 })).toBeLessThanOrEqual(MASTERY_WEIGHT * MASTERY_MAX_Z);
    expect(poolZ(0.5, { champion: 1, points: 0, games: 20, wins: 4 })).toBeLessThan(0);
  });
  it("ban suggestions follow the weight when given, else the games", () => {
    const byWeight = recommendBans("MID", [1, 2, 3, 99], world, [{ champion: 1, games: 1, weight: 0.9 }, { champion: 2, games: 40, weight: 0.01 }]);
    expect(byWeight[0].against).toBe(1);
  });
});

describe("poolNote", () => {
  it("shows mastery and the recent record, leaving out what has no data", () => {
    expect(poolNote({ champion: 1, points: 312_400, games: 6, wins: 4 })).toBe("312k mastery · 67% in 6 games");
    expect(poolNote({ champion: 1, points: 0, games: 1, wins: 1 })).toBe("100% in 1 game");
    expect(poolNote({ champion: 1, points: 800, games: 0, wins: 0 })).toBe("800 mastery");
    expect(poolNote({ champion: 1, points: 0, games: 0, wins: 0 })).toBe("");
  });
});

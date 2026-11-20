import { describe, expect, it } from "vitest";
import { DatabaseSync } from "./sqlite";
import { makeStore } from "./store";
import { matchFixture, participant } from "./testkit";

/** Ten players with damage data (so they are in the composition sample); `peel` adds heals and shields on teammates. */
const game = (id: string, peel?: { heal: number; shield: number }) => matchFixture(id, { participants: Array.from({ length: 10 }, (_, i) => participant(i, { win: i < 5,
  physicalDamageDealtToChampions: 6000, magicDamageDealtToChampions: 3000, trueDamageDealtToChampions: 1000, totalDamageTaken: 20000, timeCCingOthers: 30,
  ...(peel ? { totalHealsOnTeammates: peel.heal, totalDamageShieldedOnTeammates: peel.shield } : {}) })) });

describe("Peel data (E.2e)", () => {
  it("sums heals and shields only over games that carry them; older games are neither counted nor treated as 0", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveMatch(game("A", { heal: 500, shield: 300 }), "EMERALD", "euw1"); s.saveMatch(game("B", { heal: 700, shield: 0 }), "EMERALD", "euw1");
    s.saveMatch(game("C"), "EMERALD", "euw1");                                // collected before E.2e: columns NULL
    const ahri = s.compProfiles({}).find((r) => r.id === "Ahri")!;
    expect(ahri).toMatchObject({ games: 3, seconds: 5400, peelGames: 2, heals: 1200, shields: 300, peelSeconds: 3600 });
    expect(s.draftStats({}).profiles).toEqual(s.compProfiles({}));
  });
  it("a shield total of 0 is a measured 0 (the game still counts), while absent fields mean no sample", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveMatch(game("A", { heal: 0, shield: 0 }), "EMERALD", "euw1");
    expect(s.compProfiles({}).find((r) => r.id === "Ahri")).toMatchObject({ peelGames: 1, heals: 0, shields: 0, peelSeconds: 1800 });
    const old = makeStore(new DatabaseSync(":memory:")); old.saveMatch(game("B"), "EMERALD", "euw1");
    const row = old.compProfiles({}).find((r) => r.id === "Ahri")!;
    expect(row).not.toHaveProperty("peelGames"); expect(row).not.toHaveProperty("heals"); expect(row).not.toHaveProperty("shields");
  });
  it("adds the two columns to a database created by an earlier version and keeps its games readable", () => {
    const db = new DatabaseSync(":memory:");
    makeStore(db).saveMatch(game("OLD"), "EMERALD", "euw1");
    db.exec("ALTER TABLE participants DROP COLUMN heal; ALTER TABLE participants DROP COLUMN shield;");
    const s = makeStore(db);                                                  // the second start migrates
    expect(s.saveMatch(game("NEW", { heal: 400, shield: 100 }), "EMERALD", "euw1")).toBe(true);
    expect(s.compProfiles({}).find((r) => r.id === "Ahri")).toMatchObject({ games: 2, peelGames: 1, heals: 400, shields: 100 });
  });
});

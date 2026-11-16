import { DatabaseSync } from "./sqlite";
import { describe, expect, it } from "vitest";
import { makeStore } from "./store";
import { diverseStore, matchFixture, participant, seededStore } from "./testkit";

describe("store", () => {
  it("saves ranked solo games once and ignores duplicates, other queues and remakes", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    expect(s.saveMatch(matchFixture("EUW1_1"), "EMERALD", "euw1")).toBe(true);
    expect(s.saveMatch(matchFixture("EUW1_1"), "EMERALD", "euw1")).toBe(false);
    expect(s.saveMatch(matchFixture("EUW1_2", { queueId: 450 }), "EMERALD", "euw1")).toBe(false);
    expect(s.saveMatch(matchFixture("EUW1_3", { gameDuration: 200 }), "EMERALD", "euw1")).toBe(false);
    expect(s.counts().matches).toBe(1);
    expect(s.hasMatch("EUW1_1")).toBe(true);
  });
  it("derives the patch and reports the latest one", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveMatch(matchFixture("A", { gameVersion: "16.21.5.9", gameEndTimestamp: 1000 }), "X", "euw1");
    s.saveMatch(matchFixture("B", { gameVersion: "16.22.1.1", gameEndTimestamp: 2000 }), "X", "euw1");
    expect(s.latestPatch()).toBe("16.22");
    expect(s.matchCount({ patch: "16.21" })).toBe(1);
    expect(s.matchCount({})).toBe(2);
  });
  it("aggregates champion games and wins, per role when asked", () => {
    const s = seededStore(), ahri = s.championRows({}).find((r) => r.champion === "Ahri")!; // Ahri is the blue TOP in the fixture
    expect(ahri.games).toBe(40);
    expect(ahri.wins).toBe(26);                     // blue wins 26 of the 40 fixture games (all except n % 3 == 0)
    expect(s.championRows({}, "TOP").every((r) => r.role === "TOP")).toBe(true);
  });
  it("counts bans and ignores empty ban slots", () => {
    const bans = seededStore().bans({});
    expect(bans.find((b) => b.k === 103)?.n).toBe(40);
    expect(bans.find((b) => b.k === 222)?.n).toBe(40);
    expect(bans.some((b) => b.k === 0)).toBe(false);
  });
  it("builds lane matchups from the opposite team in the same role", () => {
    const m = seededStore().matchups("Ahri", {});   // Ahri (blue TOP) always faces Lux (red TOP)
    expect(m[0].name).toBe("Lux");
    expect(m[0].games).toBe(40);
  });
  it("aggregates keystones and final items from stored participants", () => {
    const s = seededStore();
    expect(s.keystones("Ahri", {})[0].games).toBeGreaterThan(0);
    expect(s.items("Ahri", {}).some((i) => i.id === 3157)).toBe(true);
  });
  it("hands each player to one worker at a time, least recently crawled first", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.addSeeds(["a", "b"], "EMERALD", "euw1"); s.addSeeds(["a"], "EMERALD", "euw1");
    expect(s.seedCount()).toBe(2);
    const first = s.claimSeed(1000, 2000)!, second = s.claimSeed(1000, 2000)!;
    expect(new Set([first.puuid, second.puuid])).toEqual(new Set(["a", "b"]));   // claimed, so the next caller gets the other one
    expect(s.claimSeed(1000, 2000)).toBeUndefined();                              // everyone was crawled too recently
    expect(s.claimSeed(3000, 4000)).toBeDefined();                                // later, they are due again
  });
});

describe("store filters", () => {
  it("filters by region, patch and rank (exact or tier and above)", () => {
    const s = diverseStore();                                   // 40 euw1 Emerald (16.22) + 20 na1 Diamond (16.21)
    expect(s.matchCount({})).toBe(60);
    expect(s.matchCount({ platform: "na1" })).toBe(20);
    expect(s.matchCount({ patch: "16.21" })).toBe(20);
    expect(s.matchCount({ brackets: ["DIAMOND"] })).toBe(20);
    expect(s.matchCount({ brackets: ["EMERALD", "DIAMOND"] })).toBe(60);
    expect(s.matchCount({ platform: "na1", patch: "16.22" })).toBe(0);
    expect(s.championRows({ platform: "na1" }).find((r) => r.champion === "Ahri")?.games).toBe(20);
  });
  it("lists what the data contains for the filter menus, newest patch first", () => {
    const f = diverseStore().facets();
    expect(f.platforms).toEqual([{ id: "euw1", matches: 40 }, { id: "na1", matches: 20 }]);
    expect(f.ranks.map((r) => r.id).sort()).toEqual(["DIAMOND", "EMERALD"]);
    expect(f.patches.map((p) => p.id)).toEqual(["16.22", "16.21"]);
  });
  it("upgrades a database made before platforms were tracked, keeping its data", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE matches (id TEXT PRIMARY KEY, patch TEXT NOT NULL, bracket TEXT, ended_at INTEGER NOT NULL, duration INTEGER NOT NULL, blue_win INTEGER NOT NULL);
      CREATE TABLE seeds (puuid TEXT PRIMARY KEY, tier TEXT NOT NULL, crawled_at INTEGER NOT NULL DEFAULT 0);
      INSERT INTO matches VALUES ('OLD_1', '16.20', 'EMERALD', 1, 1800, 1); INSERT INTO seeds VALUES ('old-player', 'EMERALD', 0);`);
    const s = makeStore(db);
    expect(s.matchCount({ platform: "euw1" })).toBe(0);         // platform unknown until backfilled
    s.backfillPlatform("euw1");
    expect(s.matchCount({ platform: "euw1" })).toBe(1);
  });
});

describe("ladder bookkeeping", () => {
  it("remembers each ladder (region, tier, division) separately, even when every player was already known, and expires it", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.addSeeds(["shared"], "EMERALD", "euw1");
    expect(s.isSeeded("euw1", "EMERALD", "II")).toBe(false);
    s.markSeeded("euw1", "EMERALD", "II", 1000);
    expect(s.isSeeded("euw1", "EMERALD", "II", 500)).toBe(true);
    expect(s.isSeeded("euw1", "EMERALD", "III", 500)).toBe(false);   // other divisions are separate ladders
    expect(s.isSeeded("euw1", "EMERALD", "II", 2000)).toBe(false);   // older than the refresh interval
  });
  it("ignores players whose region is unknown", () => {
    const db = new DatabaseSync(":memory:"), s = makeStore(db);
    db.exec("INSERT INTO seeds (puuid, tier, crawled_at) VALUES ('x', 'EMERALD', 0)");   // as written by an old version: no platform
    expect(s.claimSeed(1000, 2000)).toBeUndefined();
  });
});

describe("draft statistics", () => {
  it("returns champions, lane matchups and same-team pairs for the filter", () => {
    const d = seededStore().draftStats({});
    expect(d.games).toBe(40);
    expect(d.champions.find((c) => c.id === "Ahri")).toMatchObject({ games: 40, wins: 26, roles: ["TOP"] });
    expect(d.matchups.find((m) => m[0] === "Ahri" && m[1] === "Lux")).toEqual(["Ahri", "Lux", 40, 26]);       // Ahri is always the blue top
    expect(d.synergies.find((m) => m[0] === "Ahri" && m[1] === "Jinx")).toEqual(["Ahri", "Jinx", 40, 26]);    // blue teammates
    expect(d.synergies.find((m) => m[0] === "Ahri" && m[1] === "Lux")).toBeUndefined();                       // opponents are not synergies
  });
  it("respects filters and drops pairs below the minimum", () => {
    const s = diverseStore();
    expect(s.draftStats({ platform: "na1", patch: "16.21" }).games).toBe(20);
    expect(s.draftStats({}, 61).matchups).toEqual([]);          // the busiest pair has 60 games
  });
});

describe("averages", () => {
  it("averages comparable games: same champion, role and rank bracket", () => {
    const a = seededStore().averages({ role: "TOP", champion: "Ahri", bracket: "EMERALD" });
    expect(a.games).toBe(40); expect(a.kda).toBeCloseTo(1.5, 6); expect(a.cs).toBeCloseTo(110 / 30, 6); expect(a.damage).toBeCloseTo(10000 / 30, 6); expect(a.gold).toBeCloseTo(300, 6);
  });
  it("widens by dropping the champion or the bracket", () => {
    const s = seededStore();
    expect(s.averages({ role: "TOP" }).games).toBe(80); // Ahri and Lux both play top in the fixtures
    expect(s.averages({ role: "TOP", champion: "Ahri", bracket: "DIAMOND" }).games).toBe(0);
  });
  it("returns zeros, not NaN, when nothing matches", () => expect(seededStore().averages({ role: "TOP", champion: "Nobody" })).toEqual({ games: 0, kda: 0, cs: 0, damage: 0, gold: 0 }));
});

describe("rank snapshots (LP history)", () => {
  const r = (lp: number, wins = 10, losses = 10) => ({ tier: "EMERALD", division: "II", lp, wins, losses });
  it("stores a snapshot only when the rank, LP or counters changed", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    expect(s.saveRankSnapshot("p1", r(40), 1000)).toBe(true);
    expect(s.saveRankSnapshot("p1", r(40), 2000)).toBe(false);          // identical: nothing new to remember
    expect(s.saveRankSnapshot("p1", r(60, 11), 3000)).toBe(true);
    expect(s.saveRankSnapshot("p1", { ...r(60, 11), division: "I" }, 4000)).toBe(true);
    expect(s.rankHistory("p1").map((x) => x.at)).toEqual([1000, 3000, 4000]);
  });
  it("keeps players apart and returns the history oldest first", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveRankSnapshot("a", r(10), 3000); s.saveRankSnapshot("b", r(99), 1000); s.saveRankSnapshot("a", r(30, 11), 5000);
    expect(s.rankHistory("a").map((x) => x.lp)).toEqual([10, 30]);
    expect(s.rankHistory("b")).toHaveLength(1);
    expect(s.rankHistory("nobody")).toEqual([]);
  });
  it("never writes a snapshot older than the latest one", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveRankSnapshot("a", r(10), 5000);
    expect(s.saveRankSnapshot("a", r(30, 11), 4000)).toBe(false);
    expect(s.rankHistory("a")).toHaveLength(1);
  });
  it("returns only the most recent snapshots when limited, still oldest first", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    for (let i = 1; i <= 5; i++) s.saveRankSnapshot("a", r(i, 10 + i), i * 1000);
    expect(s.rankHistory("a", 3).map((x) => x.lp)).toEqual([3, 4, 5]);
  });
  it("survives reopening an existing database (table is created if missing)", () => {
    const db = new DatabaseSync(":memory:"); makeStore(db); const again = makeStore(db);
    expect(again.rankHistory("a")).toEqual([]);
  });
});


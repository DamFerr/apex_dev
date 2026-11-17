import { DatabaseSync } from "./sqlite";
import { describe, expect, it } from "vitest";
import { comparePatch, KEEP_PATCHES, lastPatches, makeStore, patchOrder } from "./store";
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
  it("sums damage by type, damage taken and CC per champion, and skips games stored without them", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    const typed = (id: string) => matchFixture(id, { participants: Array.from({ length: 10 }, (_, i) => participant(i, { win: i < 5,
      physicalDamageDealtToChampions: 6000, magicDamageDealtToChampions: 3000, trueDamageDealtToChampions: 1000, totalDamageTaken: 20000, timeCCingOthers: 30 })) });
    s.saveMatch(typed("A"), "EMERALD", "euw1"); s.saveMatch(typed("B"), "EMERALD", "euw1");
    s.saveMatch(matchFixture("C"), "EMERALD", "euw1");                       // an older game: Riot fields absent, columns NULL
    const rows = s.compProfiles({}), ahri = rows.find((r) => r.id === "Ahri")!;
    expect(ahri).toEqual({ id: "Ahri", role: expect.any(String), games: 2, phys: 12000, magic: 6000, trueDmg: 2000, taken: 40000, cc: 60, seconds: 3600 });
    expect(rows).toHaveLength(10);
    expect(s.draftStats({}).profiles).toEqual(rows);
  });
  it("keeps one profile row per champion and role", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    const typed = (id: string, pos: string) => matchFixture(id, { participants: Array.from({ length: 10 }, (_, i) => participant(i, { win: i < 5, ...(i === 0 ? { teamPosition: pos } : {}),
      physicalDamageDealtToChampions: 6000, magicDamageDealtToChampions: 3000, trueDamageDealtToChampions: 1000, totalDamageTaken: 20000, timeCCingOthers: 30 })) });
    s.saveMatch(typed("A", "TOP"), "EMERALD", "euw1"); s.saveMatch(typed("B", "MIDDLE"), "EMERALD", "euw1");
    expect(s.compProfiles({}).filter((r) => r.id === "Ahri").map((r) => [r.role, r.games]).sort()).toEqual([["MID", 1], ["TOP", 1]]);
  });
  it("adds the damage columns to a database created by an earlier version", () => {
    const db = new DatabaseSync(":memory:");
    makeStore(db); db.exec("ALTER TABLE participants DROP COLUMN dmg_p; ALTER TABLE participants DROP COLUMN dmg_m; ALTER TABLE participants DROP COLUMN dmg_t; ALTER TABLE participants DROP COLUMN taken; ALTER TABLE participants DROP COLUMN cc;");
    const s = makeStore(db);                                                 // the second start migrates
    expect(s.saveMatch(matchFixture("A"), "EMERALD", "euw1")).toBe(true);
    expect(s.compProfiles({})).toEqual([]);
  });
  it("derives the patch and reports the latest one", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveMatch(matchFixture("A", { gameVersion: "16.21.5.9", gameEndTimestamp: 1000 }), "X", "euw1");
    s.saveMatch(matchFixture("B", { gameVersion: "16.22.1.1", gameEndTimestamp: 2000 }), "X", "euw1");
    expect(s.latestPatch()).toBe("16.22");
    expect(s.matchCount({ patches: ["16.21"] })).toBe(1);
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
    expect(s.matchCount({ patches: ["16.21"] })).toBe(20);
    expect(s.matchCount({ brackets: ["DIAMOND"] })).toBe(20);
    expect(s.matchCount({ brackets: ["EMERALD", "DIAMOND"] })).toBe(60);
    expect(s.matchCount({ platform: "na1", patches: ["16.22"] })).toBe(0);
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
    expect(s.draftStats({ platform: "na1", patches: ["16.21"] }).games).toBe(20);
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


/** A ranked game on the given patch, with a unique end time. */
const onPatch = (id: string, patch: string) => matchFixture(id, { gameVersion: `${patch}.100.1`, gameEndTimestamp: 1_700_000_000_000 + Number(id.replace(/\D/g, "") || 0) });
const rows = (db: DatabaseSync, table: string) => (db.prepare(`SELECT COUNT(*) n FROM ${table}`).get() as { n: number }).n;

describe("patch order", () => {
  it("compares numerically: 16.9 is older than 16.10", () => {
    expect(comparePatch("16.9", "16.10")).toBeLessThan(0);
    expect(comparePatch("16.10", "16.9")).toBeGreaterThan(0);
    expect(comparePatch("17.1", "16.24")).toBeGreaterThan(0);
    expect(comparePatch("16.22", "16.22")).toBe(0);
    expect(["16.9", "16.10", "16.2"].sort((a, b) => b.localeCompare(a))).toEqual(["16.9", "16.2", "16.10"]);   // what a string sort would do wrong
  });
  it("orders newest first, drops duplicates and values that are not patches, and takes the newest n", () => {
    expect(patchOrder(["16.9", "16.10", "unknown", "16.2", "16.10", "", "16.10.1"])).toEqual(["16.10", "16.9", "16.2"]);
    expect(lastPatches(["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7"])).toHaveLength(KEEP_PATCHES);
    expect(lastPatches(["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7"])).toEqual(["16.7", "16.6", "16.5", "16.4", "16.3"]);
    expect(lastPatches(["16.9", "16.10"], 1)).toEqual(["16.10"]);
    expect(lastPatches([])).toEqual([]);
  });
});

describe("keeping only the last 5 patches", () => {
  const fill = (s: ReturnType<typeof makeStore>, patches: string[], each = 2) => patches.forEach((p, pi) => { for (let n = 0; n < each; n++) s.saveMatch(onPatch(`M${pi}${n}${p}`, p), "EMERALD", "euw1"); });

  it("refuses a game from a patch older than the 5 newest known, and one without a readable patch", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    fill(s, ["16.8", "16.9", "16.10", "16.11", "16.12"]);
    expect(s.saveMatch(onPatch("OLD1", "16.7"), "EMERALD", "euw1")).toBe(false);          // 6th newest
    expect(s.hasMatch("OLD1")).toBe(false);
    expect(s.saveMatch(onPatch("OK1", "16.8"), "EMERALD", "euw1")).toBe(true);            // still inside the window
    expect(s.saveMatch(matchFixture("NOVER", { gameVersion: undefined }), "EMERALD", "euw1")).toBe(false);
    expect(s.recentPatches()).toEqual(["16.12", "16.11", "16.10", "16.9", "16.8"]);
  });
  it("removes the oldest patch (games, players and bans) when a sixth patch appears, comparing numerically", () => {
    const db = new DatabaseSync(":memory:"), s = makeStore(db);
    fill(s, ["16.9", "16.10", "16.11", "16.12", "16.13"]);                                // a string sort would call 16.9 the NEWEST
    expect([rows(db, "matches"), rows(db, "participants"), rows(db, "bans")]).toEqual([10, 100, 20]);
    s.saveMatch(onPatch("NEW1", "16.14"), "EMERALD", "euw1");
    expect(s.recentPatches()).toEqual(["16.14", "16.13", "16.12", "16.11", "16.10"]);
    expect(s.matchCount({ patches: ["16.9"] })).toBe(0);
    expect(s.matchCount({ patches: ["16.10"] })).toBe(2);                                 // 16.10 survived, 16.9 did not
    expect([rows(db, "matches"), rows(db, "participants"), rows(db, "bans")]).toEqual([9, 90, 18]);
    expect(db.prepare("SELECT COUNT(*) n FROM participants WHERE match_id NOT IN (SELECT id FROM matches)").get()).toEqual({ n: 0 });   // nothing orphaned
    expect(db.prepare("SELECT COUNT(*) n FROM bans WHERE match_id NOT IN (SELECT id FROM matches)").get()).toEqual({ n: 0 });
  });
  it("does not touch rank snapshots (LP history) or seeds when deleting old patches", () => {
    const db = new DatabaseSync(":memory:"), s = makeStore(db);
    s.saveRankSnapshot("me", { tier: "EMERALD", division: "II", lp: 10, wins: 1, losses: 1 }, 1000); s.addSeeds(["x"], "EMERALD", "euw1");
    fill(s, ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7"]);
    expect(rows(db, "rank_snapshots")).toBe(1); expect(rows(db, "seeds")).toBe(1);
    expect(s.rankHistory("me")).toHaveLength(1);
  });
  it("cleans a database that already holds more than 5 patches (the startup cleanup), and a second run changes nothing", () => {
    const db = new DatabaseSync(":memory:"), s = makeStore(db);
    // Simulate data written by an older version: insert straight into the tables, bypassing the retention rule.
    db.exec("DROP INDEX IF EXISTS m_patch");
    for (const [i, p] of ["16.5", "16.6", "16.7", "16.8", "16.9", "16.10", "16.11"].entries()) db.exec(`INSERT INTO matches (id, patch, bracket, platform, ended_at, duration, blue_win) VALUES ('L${i}', '${p}', 'EMERALD', 'euw1', ${i + 1}, 1800, 1);
      INSERT INTO participants (match_id, puuid, team, champion, win, items) VALUES ('L${i}', 'x', 100, 'Ahri', 1, '[]'); INSERT INTO bans VALUES ('L${i}', 103);`);
    expect(s.pruneOldPatches()).toEqual({ kept: ["16.11", "16.10", "16.9", "16.8", "16.7"], removedMatches: 2 });
    expect([rows(db, "matches"), rows(db, "participants"), rows(db, "bans")]).toEqual([5, 5, 5]);
    expect(s.pruneOldPatches()).toEqual({ kept: ["16.11", "16.10", "16.9", "16.8", "16.7"], removedMatches: 0 });
  });
  it("never empties the database when no stored patch is valid", () => {
    const db = new DatabaseSync(":memory:"), s = makeStore(db);
    db.exec("INSERT INTO matches (id, patch, bracket, platform, ended_at, duration, blue_win) VALUES ('U', 'unknown', 'EMERALD', 'euw1', 1, 1800, 1)");
    expect(s.pruneOldPatches()).toEqual({ kept: [], removedMatches: 0 });
    expect(rows(db, "matches")).toBe(1);
  });
  it("decides the newest patch from the data, not from game end times: an old-patch game ending late does not become the latest", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveMatch(matchFixture("A", { gameVersion: "16.10.1.1", gameEndTimestamp: 1000 }), "X", "euw1");
    s.saveMatch(matchFixture("B", { gameVersion: "16.9.1.1", gameEndTimestamp: 9_000_000 }), "X", "euw1");   // finished later, but on an older patch
    expect(s.latestPatch()).toBe("16.10");
  });
  it("lists only the kept patches in the filter menus, newest first, with their real sample sizes", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    fill(s, ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6"], 3);
    expect(s.facets().patches).toEqual([{ id: "16.6", matches: 3 }, { id: "16.5", matches: 3 }, { id: "16.4", matches: 3 }, { id: "16.3", matches: 3 }, { id: "16.2", matches: 3 }]);
  });
  it("an empty patch list matches nothing, and undefined means no restriction", () => {
    const s = makeStore(new DatabaseSync(":memory:")); fill(s, ["16.1", "16.2"]);
    expect(s.matchCount({ patches: [] })).toBe(0); expect(s.matchCount({})).toBe(4); expect(s.matchCount({ patches: ["16.1", "16.2"] })).toBe(4);
  });
  it("relations: lane opponents share the role, teammates are the other four roles", () => {
    const r = seededStore().relations("Ahri", "TOP", {});
    expect(r.matchups).toEqual([{ champion: "Lux", role: "TOP", games: 40, wins: 26 }]);
    expect(r.synergies.map((x) => `${x.champion}:${x.role}`).sort()).toEqual(["Garen:ADC", "Jinx:JUNGLE", "LeeSin:SUPPORT", "Thresh:MID"]);
    expect(seededStore().relations("Lux", "TOP", {}).matchups).toEqual([{ champion: "Ahri", role: "TOP", games: 40, wins: 14 }]);     // seen from the other side the wins flip
  });
  it("relations: pairs under the minimum are left out, the limit keeps the busiest, and filters apply", () => {
    const s = diverseStore();
    expect(s.relations("Ahri", "TOP", { patches: ["16.22"] }, 41).matchups).toEqual([]);          // 40 games is under a minimum of 41
    expect(s.relations("Ahri", "TOP", {}, 5, 2).synergies).toHaveLength(2);
    expect(s.relations("Ahri", "TOP", { patches: ["16.21"] }).matchups[0]).toMatchObject({ games: 20, wins: 10 });
    expect(s.relations("Ahri", "TOP", { brackets: ["MASTER"] }).matchups).toEqual([]);
    expect(s.relations("Ahri", "JUNGLE", {}).matchups).toEqual([]);                                  // Ahri never plays jungle
  });
  it("stores Riot's FiddleSticks as Fiddlesticks, and renames games stored under the old spelling when the store opens", () => {
    const db = new DatabaseSync(":memory:"), s = makeStore(db);
    s.saveMatch(matchFixture("EUW1_1", { participants: [participant(0, { championName: "FiddleSticks" }), ...Array.from({ length: 9 }, (_, i) => participant(i + 1))] }), "EMERALD", "euw1");
    expect(s.championRows({}).map((r) => r.champion)).toContain("Fiddlesticks");
    expect(s.championRows({}).map((r) => r.champion)).not.toContain("FiddleSticks");
    db.prepare("UPDATE participants SET champion = 'FiddleSticks' WHERE champion = 'Fiddlesticks'").run();      // what an older version left behind
    s.saveMatch(matchFixture("EUW1_2", { participants: [participant(0, { championName: "FiddleSticks" }), ...Array.from({ length: 9 }, (_, i) => participant(i + 1))] }), "EMERALD", "euw1");
    const rows = makeStore(db).championRows({}).filter((r) => r.champion.toLowerCase() === "fiddlesticks");
    expect(rows.map((r) => r.champion)).toEqual(["Fiddlesticks"]); expect(rows[0].games).toBe(2);              // one champion, both games
  });
});

describe("timeline backfill bookkeeping", () => {
  it("gives every stored game a stable bucket and lists the ones without a timeline, newest first, inside the share", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    for (const id of ["EUW1_1", "EUW1_2", "EUW1_3"]) s.saveMatch(matchFixture(id), "EMERALD", "euw1");
    expect(s.timelineBacklog(1)).toBe(3); expect(s.timelineBacklog(0)).toBe(0);
    const all = s.pendingTimelines(1, ["euw1"], 10); expect(all.map((m) => m.id).sort()).toEqual(["EUW1_1", "EUW1_2", "EUW1_3"]);
    expect(s.pendingTimelines(1, ["na1"], 10)).toEqual([]); expect(s.pendingTimelines(0, ["euw1"], 10)).toEqual([]); expect(s.pendingTimelines(1, ["euw1"], 2)).toHaveLength(2);
    const some = s.pendingTimelines(0.5, ["euw1"], 10).length; expect(some).toBeLessThanOrEqual(3);
  });
  it("marks a game done when its timeline is stored and unavailable when Riot has none", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    s.saveMatch(matchFixture("EUW1_1"), "EMERALD", "euw1"); s.saveMatch(matchFixture("EUW1_2"), "EMERALD", "euw1");
    s.saveTimeline("EUW1_1", new Map()); s.markTimelineUnavailable("EUW1_2");
    expect(s.timelineBacklog(1)).toBe(0);
  });
  it("migrates a database from before the backfill: buckets are filled and games that already have a timeline count as done", () => {
    const db = new DatabaseSync(":memory:"); const s1 = makeStore(db);
    s1.saveMatch(matchFixture("EUW1_1"), "EMERALD", "euw1"); s1.saveMatch(matchFixture("EUW1_2"), "EMERALD", "euw1");
    db.exec("UPDATE participants SET skills = '[1]' WHERE match_id = 'EUW1_1'");
    db.exec("DROP INDEX m_tl; ALTER TABLE matches DROP COLUMN tl_bucket; ALTER TABLE matches DROP COLUMN tl_state;");
    const s2 = makeStore(db);                                           // the second start migrates
    expect(s2.pendingTimelines(1, ["euw1"], 10).map((m) => m.id)).toEqual(["EUW1_2"]);
  });
});

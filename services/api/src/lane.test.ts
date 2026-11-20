import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { DatabaseSync } from "./sqlite";
import { makeStore } from "./store";
import { extractTimeline, LANE_MINUTES } from "./timeline";
import type { RiotTimeline } from "./riot";
import { fakeDD, fakeRiot, idleCollector, matchFixture, memoryCache, timelineFixture } from "./testkit";

type Shot = [number, number, number]; // gold, cs, xp
/** A timeline with a frame at each given minute; `shots[minute][playerIndex]` = gold, CS and XP of that player (index 0 = participant 1). Players missing from a minute have no frame data. */
const tl = (shots: Record<number, Shot[]>, jitterMs = 0): RiotTimeline => ({
  metadata: { participants: Array.from({ length: 10 }, (_, i) => `p${i}`) },
  info: { frames: Object.entries(shots).map(([min, rows]) => ({ timestamp: Number(min) * 60_000 + jitterMs, events: [],
    participantFrames: Object.fromEntries(rows.map((r, i) => [String(i + 1), { totalGold: r[0], minionsKilled: r[1] - 5, jungleMinionsKilled: 5, xp: r[2] }])) })) },
});
const ten = (top: Shot, opp: Shot): Shot[] => Array.from({ length: 10 }, (_, i) => (i === 0 ? top : i === 5 ? opp : [3000, 70, 4000]));

describe("extractTimeline lane data", () => {
  it("reads gold, CS (lane + jungle) and XP at 10, 15 and 20 minutes; a minute the game never reached is null", () => {
    const t = extractTimeline(tl({ 10: ten([3500, 80, 4100], [3000, 70, 3900]), 15: ten([5600, 120, 6500], [5000, 115, 6400]) })).get("p0")!;
    expect(LANE_MINUTES).toEqual([10, 15, 20]);
    expect(t.lane).toEqual([3500, 80, 4100, 5600, 120, 6500, null, null, null]);
  });
  it("accepts frames a few seconds off the full minute, but not a frame that is far away", () => {
    expect(extractTimeline(tl({ 10: ten([1, 2, 3], [4, 5, 6]) }, 3000)).get("p0")!.lane!.slice(0, 3)).toEqual([1, 2, 3]);
    expect(extractTimeline(tl({ 10: ten([1, 2, 3], [4, 5, 6]) }, 20_000)).get("p0")!.lane).toBeUndefined();
  });
  it("leaves the lane key out when the timeline has no frame data, so older shapes are unchanged", () => {
    expect(extractTimeline(timelineFixture()).get("p0")).not.toHaveProperty("lane");
  });
});

/** Stores a game (p0 Ahri TOP blue against p5 Lux TOP red) with the given timeline. */
function put(store: ReturnType<typeof makeStore>, id: string, t?: RiotTimeline, extra: Parameters<typeof matchFixture>[1] = {}) {
  store.saveMatch(matchFixture(id, extra), "EMERALD", "euw1"); if (t) store.saveTimeline(id, extractTimeline(t));
}

describe("store.laneDiffs", () => {
  it("averages the lead per minute over the games that reached it, and skips games without lane data", () => {
    const store = makeStore(new DatabaseSync(":memory:"));
    put(store, "EUW1_1", tl({ 10: ten([3500, 80, 4100], [3000, 70, 3900]), 15: ten([5600, 120, 6500], [5000, 115, 6400]), 20: ten([8000, 170, 9000], [8200, 175, 9100]) }));
    put(store, "EUW1_2", tl({ 10: ten([3100, 60, 3800], [3400, 72, 4000]), 15: ten([5000, 100, 6000], [5600, 119, 6600]) }));   // ends before minute 20
    put(store, "EUW1_3");                                                                                                      // no timeline at all
    put(store, "EUW1_4", timelineFixture());                                                                                   // timeline without frame data
    const d = store.laneDiffs("Ahri", "TOP", {}).get("Lux")!;
    expect(d).toEqual([
      { minute: 10, games: 2, gold: 100, cs: -1, xp: 0 },           // (500 + -300) / 2, (10 + -12) / 2, (200 + -200) / 2
      { minute: 15, games: 2, gold: 0, cs: -7, xp: -250 },         // (600 + -600) / 2, (5 + -19) / 2, (100 + -600) / 2
      { minute: 20, games: 1, gold: -200, cs: -5, xp: -100 },       // only game 1 lasted to 20:00
    ]);
  });
  it("is empty without lane data, for another role, and for the opponent's side of the lane", () => {
    const store = makeStore(new DatabaseSync(":memory:"));
    put(store, "EUW1_1", tl({ 10: ten([3500, 80, 4100], [3000, 70, 3900]) }));
    expect(store.laneDiffs("Ahri", "MID", {}).size).toBe(0);
    expect(store.laneDiffs("Teemo", "TOP", {}).size).toBe(0);
    expect(store.laneDiffs("Lux", "TOP", {}).get("Ahri")![0]).toEqual({ minute: 10, games: 1, gold: -500, cs: -10, xp: -200 });   // mirrored: Lux is behind
    expect(makeStore(new DatabaseSync(":memory:")).laneDiffs("Ahri", "TOP", {}).size).toBe(0);
  });
  it("saving a timeline without lane data never wipes lane data already stored", () => {
    const store = makeStore(new DatabaseSync(":memory:"));
    put(store, "EUW1_1", tl({ 10: ten([3500, 80, 4100], [3000, 70, 3900]) }));
    store.saveTimeline("EUW1_1", extractTimeline(timelineFixture()));
    expect(store.laneDiffs("Ahri", "TOP", {}).get("Lux")).toHaveLength(1);
  });
  it("adds the lane column to a database created before E.5", () => {
    const db = new DatabaseSync(":memory:"); makeStore(db);
    db.exec("ALTER TABLE participants DROP COLUMN lane");
    expect(() => makeStore(db)).not.toThrow();
    expect((db.prepare("PRAGMA table_info(participants)").all() as { name: string }[]).some((c) => c.name === "lane")).toBe(true);
  });
});

describe("GET /v1/champions/:id/relations lane", () => {
  it("attaches `lane` to the matchups that have lane data and leaves it off the others and the synergies", async () => {
    const store = makeStore(new DatabaseSync(":memory:")), riot = fakeRiot();
    for (let n = 0; n < 6; n++) put(store, `EUW1_${n}`, n < 2 ? tl({ 10: ten([3500, 80, 4100], [3000, 70, 3900]) }) : undefined);
    const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
    const r = (await app.inject({ method: "GET", url: "/v1/champions/Ahri/relations?role=TOP" })).json();
    const lux = r.matchups.find((m: { champion: string }) => m.champion === "Lux");
    expect(lux.games).toBe(6); expect(lux.lane).toEqual([{ minute: 10, games: 2, gold: 500, cs: 10, xp: 200 }]);
    expect(r.synergies.every((s: { lane?: unknown }) => s.lane === undefined)).toBe(true);
  });
});

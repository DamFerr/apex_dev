import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "./sqlite";
import { buildApp } from "./app";
import { makeStore } from "./store";
import { MIN_REFERENCE_GAMES, mostPlayedRole, pickReference, toPlayerRadar, toRadarGames, type RadarRefRow } from "./radar";
import { fakeDD, fakeRiot, idleCollector, matchFixture, memoryCache, participant, seededStore } from "./testkit";
import type { Role } from "@apex/schema";
import type { RiotMatch } from "./riot";

/** A game where p0 plays `pos` (default TOP: kills 0, deaths 2, assists 3, 110 CS, 10000 damage, 9000 gold, vision 20, 1800 s). */
const game = (id: string, pos = "TOP", over: Partial<RiotMatch["info"]> = {}): RiotMatch =>
  matchFixture(id, { participants: Array.from({ length: 10 }, (_, i) => participant(i, { win: i < 5, ...(i === 0 ? { teamPosition: pos } : {}) })), ...over });
const ref = (games: number, over: Partial<RadarRefRow> = {}): RadarRefRow => ({ games, kda: 2, cs: 6, damage: 600, gold: 400, ...over });

describe("mostPlayedRole", () => {
  it("picks the role with most games, the newest wins a tie, remakes and unknown roles do not count", () => {
    expect(mostPlayedRole([game("1", "JUNGLE"), game("2", "TOP"), game("3", "TOP")], "p0")).toBe("TOP");
    expect(mostPlayedRole([game("1", "JUNGLE"), game("2", "TOP")], "p0")).toBe("JUNGLE");
    expect(mostPlayedRole([game("1", "TOP", { gameDuration: 200 }), game("2", "")], "p0")).toBeNull();
    expect(mostPlayedRole([], "p0")).toBeNull();
    expect(mostPlayedRole([game("1")], "nobody")).toBeNull();
  });
});

describe("toRadarGames", () => {
  it("keeps only games in the role, converts seconds to minutes, adds jungle CS, drops remakes", () => {
    const out = toRadarGames([game("1"), game("2", "JUNGLE"), game("3", "TOP", { gameDuration: 240 })], "p0", "TOP");
    expect(out).toEqual([{ kills: 0, deaths: 2, assists: 3, cs: 110, damage: 10000, gold: 9000, vision: 20, minutes: 30 }]);
  });
});

describe("pickReference", () => {
  it("prefers the player's tier, falls back to all ranks, and has no vision reference", () => {
    const seen: (string | undefined)[] = [];
    const tierFirst = pickReference("MID", "EMERALD", (b) => { seen.push(b); return ref(80); })!;
    expect(seen).toEqual(["EMERALD"]);
    expect(tierFirst.info).toEqual({ label: "Emerald Mid (Ranked Solo)", games: 80, tier: "EMERALD" });
    expect(tierFirst.values).toEqual({ fighting: 2, farming: 6, damage: 600, economy: 400, vision: null });
    const fallback = pickReference("ADC", "EMERALD", (b) => (b ? ref(MIN_REFERENCE_GAMES - 1) : ref(500)))!;
    expect(fallback.info).toEqual({ label: "ADC, all ranks (Ranked Solo)", games: 500, tier: null });
    expect(pickReference("TOP", undefined, () => ref(500))!.info.tier).toBeNull();
    expect(pickReference("TOP", "GOLD", () => ref(MIN_REFERENCE_GAMES - 1))).toBeNull();
  });
});

describe("toPlayerRadar", () => {
  const picked = (role: Role) => pickReference(role, undefined, () => ref(100));
  it("scores the player's most played role against the reference; vision is skipped", () => {
    const r = toPlayerRadar([game("1"), game("2"), game("3", "JUNGLE")], "p0", undefined, picked);
    expect(r.role).toBe("TOP"); expect(r.games).toBe(2); expect(r.low).toBe(true);
    expect(r.axes.map((a) => a.id)).toEqual(["fighting", "farming", "damage", "economy"]);
    expect(r.axes.find((a) => a.id === "fighting")).toMatchObject({ value: 1.5, reference: 2 });
    expect(r.axes.find((a) => a.id === "economy")).toMatchObject({ value: 300, reference: 400 });
    expect(r.overall).not.toBeNull(); expect(r.reference).toMatchObject({ games: 100 });
  });
  it("an explicit role wins over the most played one", () => {
    const r = toPlayerRadar([game("1"), game("2"), game("3", "JUNGLE")], "p0", "JUNGLE", picked);
    expect(r.role).toBe("JUNGLE"); expect(r.games).toBe(1);
  });
  it("gives an empty radar, never a made-up one, without a role or without a reference", () => {
    expect(toPlayerRadar([], "p0", undefined, picked)).toEqual({ role: null, games: 0, low: true, axes: [], overall: null, best: null, worst: null, reference: null });
    const noRef = toPlayerRadar([game("1")], "p0", undefined, () => null);
    expect(noRef).toMatchObject({ role: "TOP", games: 1, axes: [], overall: null, reference: null });
  });
  it("uses only the latest 50 games", () => {
    const many = Array.from({ length: 60 }, (_, i) => game(`g${i}`));
    expect(toPlayerRadar(many, "p0", undefined, picked).games).toBe(50);
    expect(toPlayerRadar(many, "p0", undefined, picked).low).toBe(false);
  });
});

describe("store.radarReference", () => {
  it("is totals over totals per role and bracket, and zero without games", () => {
    const s = seededStore();   // 40 Emerald games; the TOP rows are p0 (0/2/3, 110 CS, 10000 dmg) and p5 (5/2/3, 115 CS, 10005 dmg), 9000 gold, 1800 s
    const r = s.radarReference({ role: "TOP", bracket: "EMERALD" });
    expect(r.games).toBe(80);
    expect(r.kda).toBeCloseTo(440 / 160, 6);                  // (40 x (3 + 8)) / (40 x 4), not the mean of per-game ratios
    expect(r.cs).toBeCloseTo((9000 * 60) / 144_000, 6);
    expect(r.damage).toBeCloseTo((800_200 * 60) / 144_000, 6);
    expect(r.gold).toBeCloseTo(300, 6);
    expect(s.radarReference({ role: "TOP" }).games).toBe(80);
    expect(s.radarReference({ role: "TOP", bracket: "DIAMOND" })).toEqual({ games: 0, kda: 0, cs: 0, damage: 0, gold: 0 });
    expect(makeStore(new DatabaseSync(":memory:")).radarReference({ role: "TOP" }).games).toBe(0);
  });
});

describe("GET /v1/players/:riotId/radar", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    const riot = fakeRiot(), store = seededStore();
    app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
  });
  const get = (qs = "") => app.inject({ method: "GET", url: `/v1/players/Test%20Player%23EUW/radar${qs}` });

  it("compares the player's 25 TOP games with the Emerald TOP average", async () => {
    const res = await get(); expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r).toMatchObject({ role: "TOP", games: 25, low: false, reference: { label: "Emerald Top (Ranked Solo)", games: 80, tier: "EMERALD" } });
    expect(r.axes.map((a: { id: string }) => a.id)).toEqual(["fighting", "farming", "damage", "economy"]);   // vision: no reference
    expect(r.axes.find((a: { id: string }) => a.id === "economy")).toMatchObject({ value: 300, reference: 300, score: 50, letter: "B" });
    expect(r.axes.find((a: { id: string }) => a.id === "fighting")).toMatchObject({ value: 1.5 });
    expect(r.overall).toEqual(expect.any(Number));
  });
  it("another role has no games for this player but still names the reference", async () => {
    const r = (await get("?role=SUPPORT")).json();
    expect(r).toMatchObject({ role: "SUPPORT", games: 0, low: true, axes: [], overall: null });
  });
  it("rejects an unknown role or queue", async () => {
    expect((await get("?role=MIDDLE")).statusCode).toBe(400);
    expect((await get("?queue=nope")).statusCode).toBe(400);
  });
});

describe("GET /v1/players/:riotId/overview (shares the game loader with the radar)", () => {
  it("still reads the same window and lists the four teammates seen in every game", async () => {
    const riot = fakeRiot(), store = seededStore();
    const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
    const r = (await app.inject({ method: "GET", url: "/v1/players/Test%20Player%23EUW/overview?limit=30" })).json();
    expect(r.games).toBe(25); expect(r.playedWith).toHaveLength(4); expect(r.playedWith[0]).toMatchObject({ games: 25 });
    expect((await app.inject({ method: "GET", url: "/v1/players/Test%20Player%23EUW/overview?limit=5" })).json().games).toBe(5);
  });
});

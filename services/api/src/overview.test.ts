import { describe, expect, it } from "vitest";
import { toOverview } from "./overview";
import { buildApp } from "./app";
import { fakeDD, fakeRiot, idleCollector, matchFixture, memoryCache, seededStore } from "./testkit";
import type { RiotMatch, RiotParticipant } from "./riot";

/** Fixture game where `p0` (you, blue) plays with `p1` always and `p2` only when `withP2`; extra overrides per puuid. */
const game = (id: string, over: Record<string, Partial<RiotParticipant>> = {}, blueWin = true): RiotMatch => {
  const m = matchFixture(id, {}, blueWin);
  m.info.participants = m.info.participants.map((p) => ({ ...p, ...(over[p.puuid] ?? {}) }));
  return m;
};

describe("toOverview", () => {
  it("lists teammates seen in 2+ games with games and wins, never enemies or yourself", () => {
    const o = toOverview([game("a", {}, true), game("b", {}, false), game("c", { p1: { puuid: "other", riotIdGameName: "Other" } }, true)], "p0");
    expect(o.games).toBe(3);
    const names = o.playedWith.map((e) => [e.riotId ?? e.name, e.games, e.wins]);
    expect(names).toContainEqual(["Player2", 3, 2]);   // no tag in the fixture: name only
    expect(names.find((n) => n[0] === "Player1")).toEqual(["Player1", 2, 1]);
    expect(o.playedWith.some((e) => e.name === "Player0" || e.name === "Player7" || e.name === "Other")).toBe(false);
  });
  it("links teammates through Name#TAG when Riot sent the tag, and keeps the newest name", () => {
    const tagged = (n: string) => ({ p1: { riotIdGameName: n, riotIdTagline: "EUW" } });
    const o = toOverview([game("new", tagged("NewName")), game("old", tagged("OldName"))], "p0");
    expect(o.playedWith.find((e) => e.games === 2 && e.riotId === "NewName#EUW")).toBeTruthy();
  });
  it("sorts by games then wins then name and keeps at most 8", () => {
    const ms = [game("a"), game("b")], o = toOverview(ms, "p0");
    expect(o.playedWith.map((e) => e.games)).toEqual([2, 2, 2, 2]);       // the four other blue players
    expect(o.playedWith.map((e) => e.name)).toEqual(["Player1", "Player2", "Player3", "Player4"]);
    expect(toOverview([], "p0")).toEqual({ games: 0, playedWith: [] });
  });
  it("skips games you are not in", () => { expect(toOverview([game("a")], "nobody")).toEqual({ games: 0, playedWith: [] }); });
});

describe("GET /v1/players/:riotId/overview", () => {
  const setup = async () => {
    const riot = fakeRiot(), store = seededStore();
    const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
    return { riot, app, get: (url: string) => app.inject({ method: "GET", url }) };
  };
  it("covers the same latest games as the history (default 50, the fake has 25), counting your games and teammates", async () => {
    const { get } = await setup(), r = await get("/v1/players/Test%23EUW/overview");
    expect(r.statusCode).toBe(200);
    const o = r.json();
    expect(o.games).toBe(25);
    expect(o.playedWith.length).toBeGreaterThan(0); expect(o.playedWith.every((e: { games: number }) => e.games >= 2)).toBe(true);
  });
  it("limit narrows the window and an unknown queue is a 400", async () => {
    const { get } = await setup();
    expect((await get("/v1/players/Test%23EUW/overview?limit=7")).json().games).toBe(7);
    expect((await get("/v1/players/Test%23EUW/overview?queue=nope")).statusCode).toBe(400);
  });
});

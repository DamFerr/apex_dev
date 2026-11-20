import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { diverseStore, fakeDD, fakeRiot, idleCollector, matchFixture, memoryCache, seededStore } from "./testkit";

async function appWith(store: ReturnType<typeof seededStore>) {
  const riot = fakeRiot();
  return buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
}
const get = (app: Awaited<ReturnType<typeof appWith>>, url: string) => app.inject({ method: "GET", url });

// diverseStore: every game lasts 1800 s (the 30-35 minute bucket); Ahri plays TOP for blue: 40 games / 26 wins on euw1 (26.22), 20 / 10 on na1 (26.21).
describe("GET /v1/champions/:id/lengths", () => {
  it("returns five buckets for the busiest role with all games in the 30-35 minute one", async () => {
    const r = await get(await appWith(diverseStore()), "/v1/champions/Ahri/lengths?patch=all");
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.champion).toBe("Ahri"); expect(j.role).toBe("TOP");
    expect(j.buckets.map((b: { minSec: number; maxSec: number | null }) => [b.minSec, b.maxSec])).toEqual([[0, 1200], [1200, 1500], [1500, 1800], [1800, 2100], [2100, null]]);
    expect(j.buckets.map((b: { games: number; wins: number }) => [b.games, b.wins])).toEqual([[0, 0], [0, 0], [0, 0], [60, 36], [0, 0]]);
  });
  it("applies the region filter and an explicit role", async () => {
    const app = await appWith(diverseStore());
    expect((await get(app, "/v1/champions/Ahri/lengths?patch=all&region=na1")).json().buckets[3]).toMatchObject({ games: 20, wins: 10 });
    expect((await get(app, "/v1/champions/Ahri/lengths?patch=all&role=JUNGLE")).json().buckets.every((b: { games: number }) => b.games === 0)).toBe(true);
  });
  it("answers a champion with no games with a null role and no buckets", async () => {
    const r = await get(await appWith(diverseStore()), "/v1/champions/Teemo/lengths");
    expect(r.json()).toEqual({ champion: "Teemo", role: null, buckets: [] });
  });
  it("sees a long game once it is saved", async () => {
    const store = seededStore(); store.saveMatch(matchFixture("LONG", { gameDuration: 2400 }, true), "EMERALD", "euw1");
    const j = (await get(await appWith(store), "/v1/champions/Ahri/lengths")).json();
    expect(j.buckets[4]).toMatchObject({ games: 1, wins: 1 });
  });
});

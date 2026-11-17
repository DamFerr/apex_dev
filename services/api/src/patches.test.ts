import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { diverseStore, fakeDD, fakeRiot, idleCollector, matchFixture, memoryCache, seededStore } from "./testkit";

// diverseStore: 40 Emerald games on euw1 in 16.22 (blue wins 26 of them) and 20 Diamond games on na1 in 16.21 (blue wins 10).
// In every game Ahri plays TOP for blue and is banned once, so Ahri has 40/26 and 20/10.
async function appWith(store: ReturnType<typeof seededStore>) {
  const riot = fakeRiot();
  return buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
}
const get = (app: Awaited<ReturnType<typeof appWith>>, url: string) => app.inject({ method: "GET", url });

describe("GET /v1/champions/:id/patches", () => {
  it("lists every kept patch, newest first, with games, wins, bans and the patch size", async () => {
    const r = await get(await appWith(diverseStore()), "/v1/champions/Ahri/patches");
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ champion: "Ahri", role: "TOP", patches: [
      { patch: "16.22", games: 40, wins: 26, bans: 40, matches: 40 },
      { patch: "16.21", games: 20, wins: 10, bans: 20, matches: 20 }] });
  });
  it("ignores the patch filter (it always spans the kept patches) but applies region and rank", async () => {
    const app = await appWith(diverseStore());
    expect((await get(app, "/v1/champions/Ahri/patches?patch=16.22")).json().patches).toHaveLength(2);
    const euw = (await get(app, "/v1/champions/Ahri/patches?region=euw1")).json().patches;
    expect(euw).toEqual([{ patch: "16.22", games: 40, wins: 26, bans: 40, matches: 40 }, { patch: "16.21", games: 0, wins: 0, bans: 0, matches: 0 }]);
    const diamond = (await get(app, "/v1/champions/Ahri/patches?rank=DIAMOND")).json().patches; // Diamond and above: only the older patch has such games
    expect(diamond.map((p: { games: number }) => p.games)).toEqual([0, 20]);
  });
  it("reports zeros for a role the champion never played, and role null for a champion with no games", async () => {
    const app = await appWith(diverseStore());
    const mid = (await get(app, "/v1/champions/Ahri/patches?role=MID")).json();
    expect(mid.role).toBe("MID"); expect(mid.patches.every((p: { games: number; bans: number }) => p.games === 0 && p.bans > 0)).toBe(true); // bans are not tied to a role
    expect((await get(app, "/v1/champions/Teemo/patches")).json()).toEqual({ champion: "Teemo", role: null, patches: [] });
  });
  it("accepts Riot's old spelling of a champion id", async () => {
    expect((await get(await appWith(diverseStore()), "/v1/champions/FiddleSticks/patches")).json().champion).toBe("Fiddlesticks");
  });
});

describe("GET /v1/patch-trends", () => {
  it("puts the newest patch next to the previous one for champions that play the role", async () => {
    const j = (await get(await appWith(diverseStore()), "/v1/patch-trends?role=TOP")).json();
    expect(j).toMatchObject({ patch: "16.22", previous: "16.21", role: "TOP" });
    const ahri = j.rows.find((r: { id: string }) => r.id === "Ahri");
    expect(ahri).toEqual({ id: "Ahri", name: "Ahri", cur: { patch: "16.22", games: 40, wins: 26, bans: 40, matches: 40 }, prev: { patch: "16.21", games: 20, wins: 10, bans: 20, matches: 20 } });
    expect(j.rows.every((r: { id: string }) => r.id !== "Jinx")).toBe(true); // Jinx plays JUNGLE here, never TOP
  });
  it("is empty with one patch only, and says so", async () => {
    expect((await get(await appWith(seededStore()), "/v1/patch-trends?role=TOP")).json()).toEqual({ patch: "16.22", previous: null, role: "TOP", rows: [] });
  });
  it("needs a valid role", async () => {
    const app = await appWith(diverseStore());
    for (const url of ["/v1/patch-trends", "/v1/patch-trends?role=MIDDLE"]) { const r = await get(app, url); expect(r.statusCode).toBe(400); expect(r.json().error).toMatch(/role/); }
  });
  it("applies region and rank", async () => {
    const app = await appWith(diverseStore());
    const euw = (await get(app, "/v1/patch-trends?role=TOP&region=euw1")).json().rows.find((r: { id: string }) => r.id === "Ahri");
    expect(euw.prev.games).toBe(0); expect(euw.cur.games).toBe(40);
  });
});

describe("caching of the patch endpoints (they scan the whole participants table)", () => {
  async function counted() {
    const store = diverseStore(), riot = fakeRiot(); let t = 1_000_000;
    let scans = 0; const orig = store.championRowsByPatch.bind(store); store.championRowsByPatch = (...a: Parameters<typeof orig>) => { scans++; return orig(...a); };
    const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1", now: () => t });
    return { app, advance: (ms: number) => { t += ms; }, scans: () => scans };
  }
  it("answers the same request from the cache for 10 minutes, then scans again", async () => {
    const { app, advance, scans } = await counted();
    for (const url of ["/v1/champions/Ahri/patches", "/v1/patch-trends?role=TOP"]) {
      const before = scans(), first = (await get(app, url)).json();
      expect(scans()).toBe(before + 1);
      expect((await get(app, url)).json()).toEqual(first); expect(scans()).toBe(before + 1); // cached
      advance(9 * 60_000); await get(app, url); expect(scans()).toBe(before + 1);
      advance(2 * 60_000); await get(app, url); expect(scans()).toBe(before + 2); // older than 10 minutes
    }
  });
  it("keeps different filters apart and never caches an error", async () => {
    const { app, scans } = await counted();
    await get(app, "/v1/patch-trends?role=TOP"); await get(app, "/v1/patch-trends?role=TOP&region=euw1");
    expect(scans()).toBe(2);
    expect((await get(app, "/v1/patch-trends")).statusCode).toBe(400); expect((await get(app, "/v1/patch-trends")).statusCode).toBe(400);
    expect((await get(app, "/v1/patch-trends?role=TOP")).json().rows.length).toBeGreaterThan(0);
  });
  it("does not serve an answer built for an older patch window once a new patch arrives", async () => {
    const store = diverseStore(), riot = fakeRiot(); let t = 1_000_000;
    const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1", now: () => t });
    expect((await get(app, "/v1/patch-trends?role=TOP")).json().patch).toBe("16.22");
    store.saveMatch(matchFixture("NEW1", { gameVersion: "16.23.1.1" }), "Emerald", "euw1"); t += 1000; // well inside the 10 minutes
    expect((await get(app, "/v1/patch-trends?role=TOP")).json().patch).toBe("16.23");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { HttpError } from "./riot";
import { DatabaseSync } from "./sqlite";
import { makeStore } from "./store";
import { diverseStore, fakeDD, fakeRiot, idleCollector, matchFixture, memoryCache, participant, seededStore } from "./testkit";

let store: ReturnType<typeof seededStore>, riot: ReturnType<typeof fakeRiot>, app: Awaited<ReturnType<typeof buildApp>>;
beforeEach(async () => {
  riot = fakeRiot(); store = seededStore();
  const orig = riot.account; riot.account = async (n, t, r) => { try { return await orig(n, t, r); } catch { throw new HttpError(404, "Not found on Riot's servers"); } };
  app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
});
const get = (url: string) => app.inject({ method: "GET", url });

describe("API", () => {
  it("health never reveals the key", async () => { const r = await get("/health"); expect(r.json()).toEqual({ ok: true, hasKey: true }); });
  it("returns a summoner with the solo rank", async () => {
    const r = await get("/v1/players/Test%20Player%23EUW"); expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ riotId: "Test Player#EUW", level: 321, platform: "euw1", rank: { tier: "EMERALD", division: "II", lp: 64, wins: 87, losses: 79 } });
  });
  it("records rank snapshots for the LP history and returns them oldest first", async () => {
    let t = 1_000_000; const clock = () => t;
    const a = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: makeStore(new DatabaseSync(":memory:")), collector: idleCollector(riot, store), defaultPlatform: "euw1", now: clock });
    const hist = () => a.inject({ method: "GET", url: "/v1/players/Test%20Player%23EUW/lp-history" });
    const first = (await hist()).json(); expect(first.snapshots).toEqual([{ at: new Date(1_000_000).toISOString(), rank: { tier: "EMERALD", division: "II", lp: 64, wins: 87, losses: 79 } }]);
    t += 10 * 60_000; expect((await hist()).json().snapshots).toHaveLength(1); // same rank again: no new snapshot
    const league = riot.league; riot.league = async (p, pl) => (await league(p, pl)).map((e) => (e.queueType === "RANKED_SOLO_5x5" ? { ...e, leaguePoints: 82, wins: 88 } : e));
    t += 10 * 60_000; const next = (await hist()).json().snapshots; expect(next.map((x: { rank: { lp: number } }) => x.rank.lp)).toEqual([64, 82]);
  });
  it("still shows the stored LP history when Riot cannot be reached", async () => {
    let t = 1_000_000;
    const a = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: makeStore(new DatabaseSync(":memory:")), collector: idleCollector(riot, store), defaultPlatform: "euw1", now: () => t });
    const url = "/v1/players/Test%20Player%23EUW/lp-history";
    await a.inject({ method: "GET", url }); t += 10 * 60_000;
    riot.league = async () => { throw new HttpError(503, "Riot is down"); };
    const r = await a.inject({ method: "GET", url }); expect(r.statusCode).toBe(200); expect(r.json().snapshots).toHaveLength(1);
  });
  it("caches players so repeat requests do not spend Riot calls", async () => {
    await get("/v1/players/Test%23EUW"); await get("/v1/players/Test%23EUW");
    expect(riot.calls).toMatchObject({ account: 1, summoner: 1, league: 1 });
  });
  it("rejects malformed Riot IDs with a clear error", async () => {
    const r = await get("/v1/players/nohashtag"); expect(r.statusCode).toBe(400); expect(r.json().error).toMatch(/Name#TAG/);
  });
  it("reports unknown players as 404 with a message", async () => {
    const r = await get("/v1/players/Nobody%23EUW"); expect(r.statusCode).toBe(404); expect(r.json().error).toBeTruthy();
  });
  it("pages through match history with a cursor and caches matches forever", async () => {
    const p1 = (await get("/v1/players/Test%23EUW/matches?limit=10")).json();
    expect(p1.items).toHaveLength(10); expect(p1.nextCursor).toBe(10);
    const p3 = (await get("/v1/players/Test%23EUW/matches?cursor=20&limit=10")).json();
    expect(p3.items).toHaveLength(5); expect(p3.nextCursor).toBeNull(); // only 25 exist
    const before = riot.calls.match; await get("/v1/players/Test%23EUW/matches?limit=10");
    expect(riot.calls.match).toBe(before); // the first page was already cached
  });
  it("returns match detail and marks which player is you", async () => {
    const d = (await get("/v1/matches/EUW1_3?riotId=Test%23EUW")).json();
    expect(d.participants).toHaveLength(10); expect(d.participants.filter((p: { isYou: boolean }) => p.isYou)).toHaveLength(1);
  });
  it("returns mastery with champion names", async () => {
    expect((await get("/v1/players/Test%23EUW/mastery")).json()).toEqual([{ champion: "Ahri", name: "Ahri", level: 10, points: 250000 }]);
  });
});

describe("champion statistics API", () => {
  it("lists champions with games, wins, bans and roles from collected games", async () => {
    const r = (await get("/v1/champions")).json();
    expect(r.patch).toBe("16.22"); expect(r.totalGames).toBe(40);
    const ahri = r.champions.find((c: { id: string }) => c.id === "Ahri");
    expect(ahri).toMatchObject({ name: "Ahri", tags: ["Mage"], games: 40, wins: 26, bans: 40 });
    expect(ahri.roles).toContain("TOP");
  });
  it("filters by role", async () => {
    const r = (await get("/v1/champions?role=JUNGLE")).json();
    expect(r.champions.length).toBeGreaterThan(0);
    expect(r.champions.every((c: { roles: string[] }) => c.roles.includes("JUNGLE"))).toBe(true);
  });
  it("shows a champion in a role only when it really plays it there (an off-role handful of games is dropped)", async () => {
    const db = new DatabaseSync(":memory:"), st = makeStore(db);
    for (let n = 0; n < 30; n++) st.saveMatch(matchFixture(`EUW1_${n}`), "EMERALD", "euw1");          // Ahri is mid... in the fixture she is p0 = TOP
    for (let n = 30; n < 32; n++) st.saveMatch(matchFixture(`EUW1_${n}`, { participants: Array.from({ length: 10 }, (_, i) => participant(i, i === 0 ? { teamPosition: "JUNGLE" } : {})) }), "EMERALD", "euw1");
    const x = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: st, collector: idleCollector(riot, st), defaultPlatform: "euw1" });
    const top = (await x.inject({ url: "/v1/champions?role=TOP" })).json(), jungle = (await x.inject({ url: "/v1/champions?role=JUNGLE" })).json();
    expect(top.champions.find((c: { id: string }) => c.id === "Ahri")).toMatchObject({ games: 30 });   // role-specific numbers, not her 32 total
    expect(jungle.champions.find((c: { id: string }) => c.id === "Ahri")).toBeUndefined();            // 2 of 32 games (6%) is under 10%
  });
  it("returns champion detail with finished items, named keystones and matchups", async () => {
    const d = (await get("/v1/champions/Ahri")).json();
    expect(d.builds.map((b: { name: string }) => b.name)).toContain("Zhonya's Hourglass");
    expect(d.builds.map((b: { name: string }) => b.name)).not.toContain("Doran's Blade"); // starter items are filtered out
    expect(d.runes.map((x: { name: string }) => x.name)).toContain("Press the Attack");
    expect(d.matchups.length).toBeGreaterThan(0);
    expect(d.builds.find((b: { name: string }) => b.name === "Zhonya's Hourglass").id).toBe(3157);          // ids let the UI draw icons
    expect(typeof d.runes[0].id).toBe("number"); expect(typeof d.matchups[0].id).toBe("string");
  });
  it("returns rune pages, spells and items of collected games for a champion, optionally per role", async () => {
    const b = (await get("/v1/champions/Ahri/build?role=TOP")).json();
    expect(b).toMatchObject({ champion: "Ahri", role: "TOP", games: 40 });
    expect(b.runePages[0]).toMatchObject({ primaryStyleId: 8000, subStyleId: 8200, games: 40 });
    expect(b.runePages[0].perkIds).toHaveLength(9);
    expect(b.spells.ids).toEqual([14, 4]);
    expect(b.itemBlocks.map((x: { name: string }) => x.name)).toEqual(["Boots", "Core items"]);
    expect((await get("/v1/champions/Ahri/build?role=MID")).json().games).toBe(0);      // Ahri is only TOP in the fixture
    const none = (await get("/v1/champions/Teemo/build")).json();                      // no games is an empty build, not an error
    expect(none).toMatchObject({ games: 0, runePages: [], spells: null, itemBlocks: [] });
  });
  it("adds skill order, starting items and the core path from games with timelines", async () => {
    const b = (await get("/v1/champions/Ahri/build?role=TOP")).json();
    expect(b.timelineGames).toBe(40);
    expect(b.skillOrder).toMatchObject({ max: ["Q", "E", "W"], games: 40 }); expect(b.skillOrder.levels.join("")).toBe("QWEQQRQEQ");
    expect(b.startItems.items).toEqual([{ id: 1055, name: "Doran's Blade", count: 1 }, { id: 2003, name: "Health Potion", count: 2 }]);
    expect(b.corePath.items.map((i: { id: number }) => i.id)).toEqual([3157, 3089, 3100]);
    expect((await get("/v1/champions/Ahri")).json().skillOrder).toEqual(["Q", "E", "W"]);     // the champion page's skill order now has data
  });
  it("returns lane matchups and teammate synergies with the other champions' own games", async () => {
    const r = (await get("/v1/champions/Ahri/relations")).json();   // no role given: Ahri's busiest role, TOP in the fixture
    expect(r).toMatchObject({ champion: "Ahri", role: "TOP", base: { games: 40, wins: 26 } });          // blue wins 26 of the 40 games
    expect(r.matchups).toEqual([{ champion: "Lux", name: "Lux", role: "TOP", games: 40, wins: 26, baseGames: 40, baseWins: 14 }]);   // only the lane opponent, Lux is TOP on red
    expect(r.synergies.map((x: { champion: string }) => x.champion).sort()).toEqual(["Garen", "Jinx", "LeeSin", "Thresh"]);        // the four other blue players, never Ahri's own role
    expect(r.synergies.find((x: { champion: string }) => x.champion === "LeeSin")).toMatchObject({ name: "Lee Sin", role: "SUPPORT", games: 40, wins: 26, baseGames: 40, baseWins: 26 });
    expect(r.synergies.every((x: { role: string }) => x.role !== "TOP")).toBe(true);
  });
  it("relations: an explicit role without games, an unknown champion and filters give empty lists, not errors", async () => {
    const mid = await get("/v1/champions/Ahri/relations?role=MID"); expect(mid.statusCode).toBe(200);
    expect(mid.json()).toEqual({ champion: "Ahri", role: "MID", base: { games: 0, wins: 0 }, matchups: [], synergies: [] });
    expect((await get("/v1/champions/Teemo/relations")).json()).toEqual({ champion: "Teemo", role: null, base: { games: 0, wins: 0 }, matchups: [], synergies: [] });
    expect((await get("/v1/champions/Ahri/relations?role=NOPE")).json().role).toBe("TOP");        // an invalid role is ignored like everywhere else
  });
  it("shows Fiddlesticks under one id and name, and accepts Riot's old spelling in the address", async () => {
    const st = makeStore(new DatabaseSync(":memory:"));
    for (let n = 0; n < 6; n++) st.saveMatch(matchFixture(`EUW1_${n}`, { participants: [participant(0, { championName: "FiddleSticks" }), ...Array.from({ length: 9 }, (_, i) => participant(i + 1))] }), "EMERALD", "euw1");
    const x = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: st, collector: idleCollector(riot, st), defaultPlatform: "euw1" });
    const list = (await x.inject({ url: "/v1/champions" })).json().champions.filter((c: { id: string }) => c.id.toLowerCase() === "fiddlesticks");
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ id: "Fiddlesticks", name: "Fiddlesticks", games: 6 });
    for (const path of ["Fiddlesticks", "FiddleSticks"]) { for (const sub of ["", "/build", "/relations"]) expect((await x.inject({ url: `/v1/champions/${path}${sub}` })).statusCode).toBe(200); }
    expect((await x.inject({ url: "/v1/champions/FiddleSticks/relations" })).json().champion).toBe("Fiddlesticks");
  });
  it("404s for a champion without collected games", async () => { expect((await get("/v1/champions/Teemo")).statusCode).toBe(404); });
  it("reports collector status and only accepts start/stop with the X-Apex header", async () => {
    expect((await get("/v1/collector")).json()).toMatchObject({ running: false, matches: 40, ladders: { seeded: 0, total: 4 }, workers: 1, latestPatch: "16.22" });
    expect((await app.inject({ method: "POST", url: "/v1/collector/start" })).statusCode).toBe(403);
    const ok = await app.inject({ method: "POST", url: "/v1/collector/start", headers: { "x-apex": "1" } });
    expect(ok.statusCode).toBe(200); expect(ok.json().running).toBe(true);
    expect((await app.inject({ method: "POST", url: "/v1/collector/stop", headers: { "x-apex": "1" } })).json().running).toBe(false);
  });
});

describe("when Data Dragon is unavailable", () => {
  it("answers with a clear 502 instead of a generic server error", async () => {
    const down = await buildApp({ riot, cache: memoryCache(), dd: async () => { throw new Error("offline"); }, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
    const r = await down.inject({ method: "GET", url: "/v1/champions" });
    expect(r.statusCode).toBe(502); expect(r.json().error).toMatch(/Data Dragon/);
  });
});

describe("filters API", () => {
  let diverse: ReturnType<typeof diverseStore>, fapp: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => { diverse = diverseStore(); fapp = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: diverse, collector: idleCollector(riot, diverse), defaultPlatform: "euw1" }); });
  const fget = (url: string) => fapp.inject({ method: "GET", url });
  it("lists the regions, ranks and patches that have data", async () => {
    const f = (await fget("/v1/filters")).json();
    const count = (list: { id: string; matches: number }[], id: string) => list.find((x) => x.id === id)?.matches;
    expect(f.platforms).toHaveLength(17);                                           // every region is always offered
    expect([count(f.platforms, "euw1"), count(f.platforms, "na1"), count(f.platforms, "kr")]).toEqual([40, 20, 0]);
    expect(f.patches.map((p: { id: string }) => p.id)).toEqual(["16.22", "16.21"]);
    // ranks are cumulative: Emerald = Emerald and above
    expect([count(f.ranks, "IRON"), count(f.ranks, "EMERALD"), count(f.ranks, "DIAMOND"), count(f.ranks, "MASTER")]).toEqual([60, 60, 20, 0]);
  });
  it("defaults to the latest patch and all regions and ranks", async () => { expect((await fget("/v1/champions")).json()).toMatchObject({ patch: "16.22", totalGames: 40 }); });
  it("combines patch, region and rank filters", async () => {
    expect((await fget("/v1/champions?patch=all")).json().totalGames).toBe(60);
    expect((await fget("/v1/champions?patch=all&region=na1")).json().totalGames).toBe(20);
    expect((await fget("/v1/champions?patch=all&rank=DIAMOND")).json().totalGames).toBe(20);     // Diamond and above
    expect((await fget("/v1/champions?patch=all&rank=EMERALD")).json().totalGames).toBe(60);     // Emerald means Emerald and above, so Diamond games count too
    expect((await fget("/v1/champions?patch=all&rank=EMERALD%2B")).json().totalGames).toBe(60);  // "+" is accepted but means the same
    expect((await fget("/v1/champions?patch=all&rank=MASTER")).json().totalGames).toBe(0);
    expect((await fget("/v1/champions?patch=16.21&region=euw1")).json().totalGames).toBe(0);
  });
  it("applies the same filters to champion detail, and says so when nothing matches", async () => {
    expect((await fget("/v1/champions/Ahri?patch=all&region=na1")).json().games).toBe(20);
    expect((await fget("/v1/champions/Ahri/relations?patch=all&region=na1")).json()).toMatchObject({ role: "TOP", base: { games: 20 } });   // the same filters apply to relations
    expect((await fget("/v1/champions/Ahri/relations?region=na1")).json().matchups).toEqual([]);                                         // latest patch has no na1 games
    const none = await fget("/v1/champions/Ahri?region=na1");        // na1 games are on an older patch
    expect(none.statusCode).toBe(404); expect(none.json().error).toMatch(/these filters/);
  });
  it("'all patches' means the last 5 patches: older data is gone and the menu lists only those", async () => {
    const six = makeStore(new DatabaseSync(":memory:"));
    for (const [i, p] of ["16.9", "16.10", "16.11", "16.12", "16.13", "16.14"].entries()) for (let n = 0; n < 2; n++) six.saveMatch(matchFixture(`S${i}_${n}`, { gameVersion: `${p}.1.1`, gameEndTimestamp: 1_700_000_000_000 + i * 10 + n }), "EMERALD", "euw1");
    const sapp = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: six, collector: idleCollector(riot, six), defaultPlatform: "euw1" });
    const sget = (url: string) => sapp.inject({ method: "GET", url });
    expect((await sget("/v1/filters")).json().patches).toEqual([16.14, 16.13, 16.12, 16.11, 16.10].map((p, i) => ({ id: p.toFixed(2), matches: 2 })));
    expect((await sget("/v1/champions?patch=all")).json()).toMatchObject({ patch: "all", totalGames: 10 });   // 6 patches were stored, 5 are kept
    expect((await sget("/v1/champions")).json()).toMatchObject({ patch: "16.14", totalGames: 2 });
    expect((await sget("/v1/champions?patch=16.9")).json().totalGames).toBe(0);                                // a removed patch has no data
    expect((await sget("/v1/draft/data?patch=all")).json()).toMatchObject({ patch: "all", games: 10 });
  });
  it("rejects an unknown rank", async () => { expect((await fget("/v1/champions?rank=PLASTIC")).statusCode).toBe(400); });
});


describe("searching players in any region", () => {
  const home = async (europe: string[], americas: string[]) => {
    const r = fakeRiot(); const asked: string[] = [], used: string[] = [];
    r.matchIds = async (_p, region) => { asked.push(region); return region === "europe" ? europe : region === "americas" ? americas : []; };
    const sm = r.summoner; r.summoner = async (p, pf) => { used.push(pf); return sm(p, pf); };
    const x = await buildApp({ riot: r, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(r, store), defaultPlatform: "euw1" });
    return { x, asked, used };
  };
  it("finds a player on another region from one recent match, without being told the region", async () => {
    const { x, asked, used } = await home([], ["NA1_5"]);
    const r = await x.inject({ method: "GET", url: "/v1/players/Test%23NA1" });
    expect(r.json().platform).toBe("na1"); expect(used).toEqual(["na1"]);
    expect(asked).toEqual(["europe", "americas"]);                                  // the preferred region first, then the others
  });
  it("remembers where a player lives, so later requests do not search again", async () => {
    const { x, asked } = await home([], ["NA1_5"]);
    await x.inject({ method: "GET", url: "/v1/players/Test%23NA1" }); await x.inject({ method: "GET", url: "/v1/players/Test%23NA1/mastery" });
    expect(asked).toEqual(["europe", "americas"]);
  });
  it("falls back to asking each platform when the player has no recent matches", async () => {
    const r = fakeRiot(); r.matchIds = async () => [];
    r.summoner = async (_p, pf) => { if (pf !== "kr") throw new HttpError(404, "no"); return { summonerLevel: 30 }; };
    const x = await buildApp({ riot: r, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(r, store), defaultPlatform: "euw1" });
    expect((await x.inject({ method: "GET", url: "/v1/players/Quiet%23KR1" })).json().platform).toBe("kr");
  });
  it("says so when the player exists nowhere", async () => {
    const r = fakeRiot(); r.matchIds = async () => []; r.summoner = async () => { throw new HttpError(404, "no"); };
    const x = await buildApp({ riot: r, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(r, store), defaultPlatform: "euw1" });
    const res = await x.inject({ method: "GET", url: "/v1/players/Ghost%23000" });
    expect(res.statusCode).toBe(404); expect(res.json().error).toMatch(/any region/);
  });
});

describe("draft data and champion pool APIs", () => {
  it("serves collected draft statistics that follow the filters", async () => {
    const d = (await get("/v1/draft/data")).json();
    expect(d.games).toBe(40); expect(d.patch).toBe("16.22");
    expect(d.champions.find((c: { id: string }) => c.id === "Ahri")).toMatchObject({ games: 40, wins: 26 });
    expect(d.matchups.length).toBeGreaterThan(0); expect(d.synergies.length).toBeGreaterThan(0);
  });
  it("builds your pool from recent games and mastery", async () => {
    const pool = (await get("/v1/players/Test%23EUW/pool")).json();
    expect(pool[0]).toEqual({ champion: "Ahri", games: 20, wins: 20, points: 250000 });   // the fake player is Ahri in all 20 recent games
  });

  describe("live game", () => {
    it("returns all ten players with rank, smite flag, bans and who you are", async () => {
      const g = (await get("/v1/live/Test%23EUW")).json();
      expect(g).toMatchObject({ inGame: true, queue: "Ranked Solo", mode: "CLASSIC", lengthSec: 372 });
      expect(g.players).toHaveLength(10);
      expect(g.players.filter((p: { isYou: boolean }) => p.isYou).map((p: { riotId: string }) => p.riotId)).toEqual(["Player0#EUW"]);
      expect(g.players[0]).toMatchObject({ champion: "Ahri", team: "blue", rank: { tier: "EMERALD", division: "II", wins: 87, losses: 79 }, jungle: false });
      expect(g.players.filter((p: { jungle: boolean }) => p.jungle).map((p: { champion: string }) => p.champion)).toEqual(["LeeSin", "Ornn"]);
      expect(g.players[1].hotStreak).toBe(true); expect(g.players[0].hotStreak).toBe(false);
      expect(g.bans).toEqual([{ champion: "Ahri", championName: "Ahri", team: "blue" }, { champion: "Jinx", championName: "Jinx", team: "red" }]); // the empty ban slot (-1) is dropped
    });
    it("adds the collected win rate for each champion", async () => {
      const g = (await get("/v1/live/Test%23EUW")).json();
      expect(g.players[0].champGames).toBeGreaterThan(0); // Ahri appears in the seeded games
      expect(g.players[0].champWins).toBeLessThanOrEqual(g.players[0].champGames);
    });
    it("says not in game (200, not an error) when Riot returns 404 for the Spectator lookup", async () => {
      const r = await get("/v1/live/Offline%23EUW"); expect(r.statusCode).toBe(200); expect(r.json()).toEqual({ inGame: false });
    });
    it("still reports an unknown player as 404", async () => { expect((await get("/v1/live/Nobody%23EUW")).statusCode).toBe(404); });
    it("shows no rank for a player whose rank lookup fails, instead of failing the whole screen", async () => {
      const league = riot.league; riot.league = async (puuid, pf) => { if (puuid === "p3") throw new HttpError(502, "boom"); return league(puuid, pf); };
      const g = (await get("/v1/live/Test%23EUW")).json();
      expect(g.players[3].rank).toBeNull(); expect(g.players[2].rank).not.toBeNull();
    });
    it("caches a lookup so refreshes do not spend Riot calls", async () => {
      await get("/v1/live/Test%23EUW"); const before = { ...riot.calls }; await get("/v1/live/Test%23EUW");
      expect(riot.calls.activeGame).toBe(before.activeGame); expect(riot.calls.league).toBe(before.league);
    });
    it("rejects malformed Riot IDs", async () => { expect((await get("/v1/live/nohashtag")).statusCode).toBe(400); });
  });

  describe("post-game recap", () => {
    it("recaps the latest game against Emerald Ahri Top averages, your own games and the lobby", async () => {
      const r = (await get("/v1/players/Test%23EUW/recap")).json();
      expect(r).toMatchObject({ matchId: "EUW1_0", queue: "Ranked Solo", win: true, champion: "Ahri", role: "TOP", kills: 0, deaths: 2, assists: 3 });
      expect(r.baseline).toEqual({ label: "Emerald Ahri Top (Ranked Solo)", games: 40 });
      expect(r.personal).toEqual({ games: 10 });
      expect(r.killParticipation).toBeCloseTo(0.3, 6); expect(r.damageShare).toBeCloseTo(10000 / 50010, 6);
      const byId = Object.fromEntries(r.metrics.map((m: { id: string }) => [m.id, m]));
      expect(byId.kda).toMatchObject({ you: 1.5, vsRank: 1.5, vsYou: 1.5, lobbyRank: 10 }); // every other player has a better KDA
      expect(byId.gold.lobbyRank).toBe(1); // nobody earned more gold than you (all equal)
      expect(byId.cs.you).toBeCloseTo(110 / 30, 6);
    });
    it("recaps a chosen match", async () => { expect((await get("/v1/players/Test%23EUW/recap?matchId=EUW1_5")).json().matchId).toBe("EUW1_5"); });
    it("rejects an unknown match id", async () => { expect((await get("/v1/players/Test%23EUW/recap?matchId=XX_1")).statusCode).toBe(400); });
    it("says so when the player has no games", async () => {
      riot.matchIds = async () => []; const r = await get("/v1/players/Test%23EUW/recap"); expect(r.statusCode).toBe(404);
    });
    it("shows no rank comparison when too few games are collected, instead of a misleading one", async () => {
      const empty = makeStore(new DatabaseSync(":memory:"));
      const a = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store: empty, collector: idleCollector(riot, empty), defaultPlatform: "euw1" });
      const r = (await a.inject({ method: "GET", url: "/v1/players/Test%23EUW/recap" })).json();
      expect(r.baseline).toBeNull(); expect(r.metrics.every((m: { vsRank: number | null }) => m.vsRank === null)).toBe(true);
    });
    it("shows no personal comparison with fewer than 3 other games in the role", async () => {
      riot.matchIds = async () => ["EUW1_0", "EUW1_1", "EUW1_2"]; // only 2 others
      const r = (await get("/v1/players/Test%23EUW/recap")).json(); expect(r.personal).toBeNull(); expect(r.metrics[0].vsYou).toBeNull();
    });
  });
});


import { DatabaseSync } from "./sqlite";
import { describe, expect, it } from "vitest";
import { Collector, type CollectorConfig } from "./collector";
import { HttpError } from "./riot";
import { fakeRiot, matchFixture } from "./testkit";
import { makeStore } from "./store";

const base: CollectorConfig = { platforms: ["euw1"], tiers: ["EMERALD"], pages: 1, matchesPerPlayer: 5, recrawlMs: 1000, concurrency: 1 };
function setup(over: Partial<CollectorConfig> = {}) {
  const riot = fakeRiot(), store = makeStore(new DatabaseSync(":memory:")); let t = 10_000;
  // The fake sleep advances the clock and yields to the event loop, so idle workers cannot spin forever.
  const c = new Collector(riot, store, { ...base, ...over }, () => t, async () => { t += 250; await new Promise((r) => setImmediate(r)); });
  return { riot, store, c, advance: (ms: number) => { t += ms; } };
}
const own = (riot: ReturnType<typeof fakeRiot>) => { riot.ladder = async (pf, tier, div) => [{ puuid: `${pf}-${tier}-${div}`, tier, rank: div, leaguePoints: 1 }]; }; // players are unique per ladder, like real life

describe("Collector and patches", () => {
  it("does not store a game older than the 5 newest patches, and does not download it again on the next crawl", async () => {
    const { c, riot, store } = setup(); own(riot);
    const versions = ["16.13", "16.12", "16.11", "16.10", "16.9", "16.8"];           // newest first, like Riot's match list; 16.8 is the 6th newest
    let fetched = 0;
    riot.matchIds = async () => versions.map((_, i) => `EUW1_${i}`);
    riot.match = async (id) => { fetched++; const i = Number(id.split("_")[1]); return matchFixture(id, { gameVersion: `${versions[i]}.1.1`, gameEndTimestamp: 1_700_000_000_000 - i }); };
    store.addSeeds(["p0"], "EMERALD", "euw1");
    const crawl = () => (c as unknown as { crawlOne(): Promise<boolean> }).crawlOne();
    await crawl();
    expect(fetched).toBe(6);
    expect(store.recentPatches()).toEqual(["16.13", "16.12", "16.11", "16.10", "16.9"]);
    expect(store.counts().matches).toBe(5);
    expect(store.hasMatch("EUW1_5")).toBe(false);                                     // the 16.8 game was refused
    store.markCrawled("p0", 0); await crawl();                                        // the same player again
    expect(fetched).toBe(6);                                                          // nothing was downloaded twice, not even the refused game
  });
});

describe("Collector", () => {
  it("sends parallel workers to different regional clusters, because Riot limits each cluster separately", async () => {
    const { c, riot, store } = setup({ platforms: ["euw1", "eun1", "kr", "na1"], tiers: ["MASTER"], concurrency: 3 });
    for (const [pf, n] of [["euw1", 5], ["eun1", 5], ["kr", 1], ["na1", 1]] as const) store.addSeeds(Array.from({ length: n }, (_, i) => `${pf}-${i}`), "MASTER", pf); // europe has most players
    const regions: string[] = []; let release!: () => void; const gate = new Promise<void>((r) => (release = r));
    riot.matchIds = async (_p, region) => { regions.push(region); await gate; return []; };
    const crawl = (c as unknown as { crawlOne(): Promise<boolean> }).crawlOne.bind(c);
    const running = Promise.all([crawl(), crawl(), crawl()]);       // three workers start at once
    release(); await running;
    expect(new Set(regions)).toEqual(new Set(["europe", "asia", "americas"]));   // not three workers queueing on europe
  });
  it("hides an old error: the status only keeps it while it is recent or fatal", async () => {
    const { c, riot } = setup(); let t = 0; riot.ladder = async () => { if (t++ === 0) throw new HttpError(502, "Could not reach Riot's servers (ECONNRESET)"); return []; };
    c.start(); await new Promise((r) => setTimeout(r, 30)); await c.halt();
    expect(c.status).toMatchObject({ lastError: expect.stringContaining("ECONNRESET"), fatal: false, errorsThisRun: 1 });
    expect(c.status.lastErrorAt).toBeGreaterThan(0);
  });
  it("covers every region x tier x division, with a single division for Master and above", () => {
    const { c } = setup({ platforms: ["euw1", "na1"], tiers: ["EMERALD", "MASTER"] });
    expect(c.ladders()).toHaveLength(2 * (4 + 1));
    expect(c.ladders().filter((l) => l.tier === "MASTER").map((l) => l.division)).toEqual(["I", "I"]);
  });
  it("reads every ladder and starts crawling players before all ladders are done", async () => {
    const { c, riot, store } = setup({ platforms: ["euw1", "na1"], tiers: ["EMERALD", "DIAMOND"] }); own(riot);
    const sizes: number[] = [];
    for (let i = 0; i < 40; i++) { await c.step(); sizes.push(store.counts().matches); }
    expect(c.progress()).toEqual({ seeded: 16, total: 16 });
    expect(sizes.findIndex((n) => n > 0)).toBeLessThan(6);        // matches appear long before the last ladder is read
  });
  it("crawls each player in their own region", async () => {
    const { c, riot } = setup({ platforms: ["euw1", "na1"], tiers: ["MASTER"] }); own(riot);
    const regions: string[] = [], orig = riot.matchIds; riot.matchIds = async (p, r, ...rest) => { regions.push(r); return orig(p, r, ...rest); };
    for (let i = 0; i < 8; i++) await c.step();
    expect(new Set(regions)).toEqual(new Set(["europe", "americas"]));
  });
  it("counts an empty ladder as read (a tiny region has no Challenger players)", async () => {
    const { c, riot } = setup({ tiers: ["CHALLENGER"] }); riot.ladder = async () => [];
    await c.step();
    expect(c.progress()).toEqual({ seeded: 1, total: 1 });
  });
  it("reports a ladder with players but no puuid field as an error and does not mark it read", async () => {
    const { c, riot } = setup({ tiers: ["MASTER"] }); riot.ladder = async () => [{ tier: "MASTER", rank: "I", leaguePoints: 1 }];
    await expect(c.step()).rejects.toThrow(/puuid/);
    expect(c.progress().seeded).toBe(0);
  });
  it("skips a failing ladder for a while so it cannot block the others", async () => {
    const { c, riot } = setup({ platforms: ["na1", "euw1"], tiers: ["MASTER"] }); own(riot);
    const orig = riot.ladder; riot.ladder = async (pf, ...rest) => { if (pf === "na1") throw new HttpError(500, "boom"); return orig(pf, ...rest); };
    await expect(c.step()).rejects.toThrow("boom");
    await c.step();
    expect(c.progress().seeded).toBe(1);                           // euw1 was read even though na1 keeps failing
  });
  it("reads ladders again after a week", async () => {
    const { c, riot, advance } = setup({ tiers: ["MASTER"] }); own(riot);
    await c.step(); expect(riot.calls.ladder).toBeUndefined();     // own() replaced the counted fake, so count via progress instead
    expect(c.progress().seeded).toBe(1);
    advance(8 * 24 * 3600_000);
    expect(c.progress().seeded).toBe(0);                           // due again
  });
  it("stores new matches once and skips ones it already has", async () => {
    const { c, riot, store } = setup({ tiers: ["MASTER"] });
    for (let i = 0; i < 6; i++) await c.step();
    expect(store.counts().matches).toBe(5);                        // both fake players list the same 5 matches
    expect(riot.calls.match).toBe(5);
  });
  it("is idle once every ladder was read and every player crawled recently", async () => {
    const { c } = setup({ tiers: ["MASTER"] });
    await c.step(); await c.step(); await c.step();
    expect(await c.step()).toBe("idle");
  });
  it("only collects ranked solo games, at low priority", async () => {
    const { c, riot } = setup({ tiers: ["MASTER"] }); const seen: unknown[] = [];
    const orig = riot.matchIds; riot.matchIds = async (...a) => { seen.push([a[4], a[5]]); return orig(...a); };
    await c.step(); await c.step();
    expect(seen[0]).toEqual([420, true]);
  });
  it("stops by itself when Riot rejects the key, and keeps the reason", async () => {
    const { c, riot } = setup();
    riot.ladder = async () => { throw new HttpError(502, "Riot rejected the API key (expired or invalid). Check RIOT_API_KEY"); };
    c.start(); await c.halt();
    expect(c.status.running).toBe(false);
    expect(c.status.lastError).toMatch(/API key/);
  });
  it("starts and halts cleanly with several workers, and never crawls one player twice at the same time", async () => {
    const { c, riot } = setup({ tiers: ["MASTER"], concurrency: 4 });
    riot.ladder = async () => Array.from({ length: 30 }, (_, i) => ({ puuid: `pl${i}`, tier: "MASTER", rank: "I", leaguePoints: 1 }));
    const active = new Set<string>(); let overlap = false, crawls = 0, orig = riot.matchIds;
    riot.matchIds = async (p, ...rest) => { if (active.has(p)) overlap = true; active.add(p); crawls++; await new Promise((r) => setImmediate(r)); active.delete(p); return orig(p, ...rest); };
    c.start(); expect(c.status.running).toBe(true);
    await new Promise((r) => setTimeout(r, 60)); await c.halt();
    expect(c.status.running).toBe(false);
    expect(crawls).toBeGreaterThan(4); expect(overlap).toBe(false);
  });
});

describe("Collector timelines", () => {
  const run = async (over: Partial<CollectorConfig>, tweak?: (r: ReturnType<typeof fakeRiot>) => void) => {
    const { c, riot, store } = setup(over); store.addSeeds(["p0"], "EMERALD", "euw1"); tweak?.(riot);
    await (c as unknown as { crawlOne(): Promise<boolean> }).crawlOne(); return { c, riot, store };
  };
  it("fetches no timelines by default", async () => { const { riot, store } = await run({}); expect(store.counts().matches).toBe(5); expect(riot.calls.timeline).toBeUndefined(); });
  it("fetches a timeline for every stored game when the share is 1, and stores skill order and items", async () => {
    const { riot, store, c } = await run({ timelineShare: 1 });
    expect(riot.calls.timeline).toBe(5); expect(c.status.timelinesThisRun).toBe(5);
    expect(store.buildRows("Ahri", {}).every((r) => r.skills && r.start && r.buys)).toBe(true);
  });
  it("never loses a game when its timeline is missing", async () => {
    const { store, c } = await run({ timelineShare: 1 }, (r) => { r.timeline = async () => { throw new HttpError(404, "Not found on Riot's servers"); }; });
    expect(store.counts().matches).toBe(5); expect(c.status.timelinesThisRun).toBe(0);
  });
  it("stops on a bad API key even while fetching a timeline", async () => {
    const { riot, c } = setup({ timelineShare: 1 }); riot.timeline = async () => { throw new HttpError(502, "Riot rejected the API key (expired or invalid)."); };
    await expect((c as unknown as { saveTimeline(id: string, r: string): Promise<void> }).saveTimeline("EUW1_1", "europe")).rejects.toThrow(/API key/);
  });
});

describe("Collector timeline backfill", () => {
  type Priv = { backfillOne(): Promise<boolean> };
  /** Stores 5 games WITHOUT timelines (share 0), then turns the share on, as after raising COLLECT_TIMELINES. */
  const stored = async (share = 1) => {
    const { c, riot, store } = setup({}); store.addSeeds(["p0"], "EMERALD", "euw1");
    await (c as unknown as { crawlOne(): Promise<boolean> }).crawlOne();
    c.cfg.timelineShare = share; c.cfg.backfillEvery = 1; return { c, riot, store, run: () => (c as unknown as Priv).backfillOne() };
  };
  it("fetches the timelines of stored games that have none, and then has nothing left to do", async () => {
    const { c, riot, store, run } = await stored();
    expect(store.timelineBacklog(1)).toBe(5);
    expect(await run()).toBe(true);
    expect(riot.calls.timeline).toBe(5); expect(c.status.backfilledThisRun).toBe(5); expect(store.timelineBacklog(1)).toBe(0);
    expect(store.buildRows("Ahri", {}).every((r) => r.skills && r.start && r.buys)).toBe(true);
    expect(await run()).toBe(false);
  });
  it("does nothing when the share is 0", async () => { const { riot, run } = await stored(0); expect(await run()).toBe(false); expect(riot.calls.timeline).toBeUndefined(); });
  it("never asks again for a game Riot has no timeline for", async () => {
    const { riot, store, run } = await stored(); let calls = 0; riot.timeline = async () => { calls++; throw new HttpError(404, "Not found"); };
    await run(); expect(calls).toBe(5); expect(store.timelineBacklog(1)).toBe(0);
    expect(await run()).toBe(false); expect(calls).toBe(5);
  });
  it("skips a game after a temporary failure (until restart) without blocking the others", async () => {
    const { c, riot, run } = await stored(); const real = riot.timeline.bind(riot); let first = true;
    riot.timeline = async (id, r, low) => { if (first) { first = false; throw new HttpError(500, "boom"); } return real(id, r, low); };
    await run(); expect(c.status.backfilledThisRun).toBe(4);
    expect(await run()).toBe(false);                                  // the failed one is parked, nothing else is pending
  });
  it("stops the collector on a bad API key", async () => {
    const { riot, run } = await stored(); riot.timeline = async () => { throw new HttpError(502, "Riot rejected the API key (expired or invalid)."); };
    await expect(run()).rejects.toThrow(/API key/);
  });
  it("runs inside step() only every Nth step, and never when off", async () => {
    const { c, riot } = await stored(); c.cfg.backfillEvery = 3;
    await c.step(); await c.step(); expect(riot.calls.timeline).toBeUndefined();
    await c.step(); expect(riot.calls.timeline).toBe(5);
    const off = await stored(); off.c.cfg.backfillEvery = 0; for (let i = 0; i < 4; i++) await off.c.step(); expect(off.riot.calls.timeline).toBeUndefined();
  });
});

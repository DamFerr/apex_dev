import { HttpError, PLATFORM_IDS, regionOf, type RiotApi } from "./riot";
import type { Store } from "./store";
import { extractTimeline, inShare } from "./timeline";

export const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"]; // these ladders have a single division
const DIVISIONS = ["I", "II", "III", "IV"];
const RESEED_MS = 7 * 24 * 3600_000, RETRY_MS = 10 * 60_000;

export interface CollectorConfig { platforms: string[]; tiers: string[]; pages: number; matchesPerPlayer: number; recrawlMs: number; concurrency: number;
  /** Share (0 to 1) of newly stored games that also get their timeline (skill order, starting items, build order). Each costs one more Riot request. Default 0. */ timelineShare?: number }
export interface Ladder { platform: string; tier: string; division: string }

/**
 * Background crawler that covers EVERY region and rank by default. It reads each ranked ladder (region x tier x division),
 * then keeps taking the least recently crawled player and storing their new Ranked Solo games. Several workers run in
 * parallel (Riot limits each region separately), all at low priority so interactive requests always have room.
 */
export class Collector {
  status = { running: false, lastError: null as string | null, lastErrorAt: 0, fatal: false, errorsThisRun: 0, savedThisRun: 0, timelinesThisRun: 0 };
  /** Workers currently busy per regional cluster (europe, americas, asia, sea). */
  private busy = new Map<string, number>();
  private stopping = false; private loops: Promise<void>[] = []; private tick = 0;
  private inFlight = new Set<string>(); private failedUntil = new Map<string, number>();
  /** Matches that were downloaded but not stored (older than the 5 kept patches, remakes), so the next crawl does not download them again. Emptied when large; it only saves requests. */
  private skipped = new Set<string>();
  constructor(private riot: RiotApi, private store: Store, public cfg: CollectorConfig, private now = () => Date.now(),
    private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {}

  ladders(): Ladder[] {
    return this.cfg.platforms.flatMap((platform) => this.cfg.tiers.flatMap((tier) => (APEX_TIERS.includes(tier) ? ["I"] : DIVISIONS).map((division) => ({ platform, tier, division }))));
  }
  progress() { const all = this.ladders(), since = this.now() - RESEED_MS; return { seeded: all.filter((l) => this.store.isSeeded(l.platform, l.tier, l.division, since)).length, total: all.length }; }
  get running() { return this.loops.length > 0; }

  start() {
    if (this.loops.length) return;
    this.stopping = false; this.status = { running: true, lastError: null, lastErrorAt: 0, fatal: false, errorsThisRun: 0, savedThisRun: 0, timelinesThisRun: 0 };
    const loops = Array.from({ length: Math.max(1, this.cfg.concurrency) }, () => this.run());
    this.loops = loops;
    void Promise.all(loops).finally(() => { if (this.loops === loops) { this.loops = []; this.status.running = false; } });
  }
  async halt() { this.stopping = true; await Promise.all(this.loops); }
  private async nap(ms: number) { for (let t = 0; t < ms && !this.stopping; t += 250) await this.sleep(250); }

  /** Reads one ladder that has not been read for a week. Returns false when none is due. */
  private async seedOne(): Promise<boolean> {
    const since = this.now() - RESEED_MS, t = this.now();
    const ladder = this.ladders().find((l) => { const k = key(l); return !this.inFlight.has(k) && (this.failedUntil.get(k) ?? 0) < t && !this.store.isSeeded(l.platform, l.tier, l.division, since); });
    if (!ladder) return false;
    const k = key(ladder); this.inFlight.add(k);
    try {
      for (let page = 1; page <= this.cfg.pages && !this.stopping; page++) {
        const entries = await this.riot.ladder(ladder.platform, ladder.tier, ladder.division, page, true);
        if (!entries.length) break;
        const ids = entries.map((e) => e.puuid).filter((p): p is string => !!p);
        if (!ids.length) throw new Error("Riot's ladder response has no puuid field, so players cannot be collected.");
        this.store.addSeeds(ids, ladder.tier, ladder.platform);
      }
      this.store.markSeeded(ladder.platform, ladder.tier, ladder.division, this.now()); // an empty ladder (tiny region) still counts as read
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) this.store.markSeeded(ladder.platform, ladder.tier, ladder.division, this.now());
      else { this.failedUntil.set(k, this.now() + RETRY_MS); throw e; } // skip a failing ladder for a while instead of blocking the others
    } finally { this.inFlight.delete(k); }
    return true;
  }

  /**
   * Crawls the least recently crawled player. Returns false when everyone was crawled recently.
   * Riot's limits apply per regional cluster (Match-v5 goes to europe / americas / asia / sea), so each worker picks its player from
   * the cluster that currently has the fewest busy workers. That keeps every cluster's limit in use instead of piling all workers onto one.
   */
  private async crawlOne(): Promise<boolean> {
    const clusters = [...new Set(this.cfg.platforms.map(regionOf))].sort((a, b) => (this.busy.get(a) ?? 0) - (this.busy.get(b) ?? 0));
    for (const region of clusters) {
      const seed = this.store.claimSeed(this.now() - this.cfg.recrawlMs, this.now(), this.cfg.platforms.filter((p) => regionOf(p) === region));
      if (!seed) continue;
      this.busy.set(region, (this.busy.get(region) ?? 0) + 1);
      try {
        for (const id of await this.riot.matchIds(seed.puuid, region, 0, this.cfg.matchesPerPlayer, 420, true)) {
          if (this.stopping) break;
          if (this.store.hasMatch(id) || this.skipped.has(id)) continue;
          if (this.store.saveMatch(await this.riot.match(id, region, true), seed.tier, seed.platform)) { this.status.savedThisRun++; await this.saveTimeline(id, region); }
          else { if (this.skipped.size >= 50_000) this.skipped.clear(); this.skipped.add(id); }
        }
      } finally { this.busy.set(region, (this.busy.get(region) ?? 1) - 1); }
      return true;
    }
    return false;
  }

  /** Fetches the timeline of a share of the stored games. A failed or missing timeline never loses the game itself; only a bad API key stops the collector. */
  private async saveTimeline(id: string, region: string) {
    if (!inShare(id, this.cfg.timelineShare ?? 0)) return;
    try { this.store.saveTimeline(id, extractTimeline(await this.riot.timeline(id, region, true))); this.status.timelinesThisRun++; }
    catch (e) { if (e instanceof HttpError && /API key/.test(e.message)) throw e; }
  }

  /** One unit of work: mostly crawling, with every third step reading a ladder first so new regions fill in early. */
  async step(): Promise<"worked" | "idle"> {
    const seedFirst = this.tick++ % 3 === 0;
    if (seedFirst && (await this.seedOne())) return "worked";
    if (await this.crawlOne()) return "worked";
    if (!seedFirst && (await this.seedOne())) return "worked";
    return "idle";
  }

  private async run() {
    while (!this.stopping) {
      try { if ((await this.step()) === "idle") await this.nap(30_000); }
      catch (e) {
        this.status.lastError = e instanceof Error ? e.message : String(e); this.status.lastErrorAt = this.now(); this.status.errorsThisRun++;
        if (e instanceof HttpError && /API key/.test(e.message)) { this.status.fatal = true; return; } // no point retrying with a bad key
        await this.nap(10_000);
      }
    }
  }
}
const key = (l: Ladder) => `${l.platform}:${l.tier}:${l.division}`;
/** Every region Riot has, the busiest first so they fill in earliest. */
const BUSIEST = ["euw1", "na1", "kr", "eun1", "br1", "tr1", "jp1", "la1", "la2", "oc1", "ru"];
export const ALL_PLATFORMS = [...BUSIEST, ...PLATFORM_IDS.filter((p) => !BUSIEST.includes(p))];

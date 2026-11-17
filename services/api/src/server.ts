import { buildApp } from "./app";
import { ALL_PLATFORMS, Collector, TIERS } from "./collector";
import { config } from "./config";
import { makeCache, openDatabase } from "./db";
import { ddLoader } from "./ddragon";
import { HostLimiters } from "./rateLimiter";
import { HttpRiot } from "./riot";
import { makeStore } from "./store";

if (!config.riotKey) {
  console.error("RIOT_API_KEY is missing. Copy services/api/.env.example to services/api/.env and put your key in it.");
  process.exit(1);
}
// Riot limits each region separately, so each host gets its own limiter. The collector gets COLLECT_SHARE of each window (80% by default).
const limiters = new HostLimiters([{ limit: config.ratePerSecond, ms: 1000 }, { limit: config.ratePer2Min, ms: 120_000 }], undefined, undefined, config.collectShare);
const riot = new HttpRiot(config.riotKey, limiters), db = openDatabase(config.dbPath), store = makeStore(db), cache = makeCache(db);
store.backfillPlatform(config.platform);
const pruned = store.pruneOldPatches(); // only the newest 5 patches are kept; older games are deleted on every start
console.log(`Patches kept: ${pruned.kept.join(", ") || "none yet"}${pruned.removedMatches ? ` (removed ${pruned.removedMatches.toLocaleString()} games of older patches)` : ""}.`);
if (pruned.removedMatches > 0) { // freed space is only reused by SQLite, so shrink the file once after a real cleanup (the collector is not running yet)
  console.log("Shrinking the database file after the cleanup (can take a minute on a big database)...");
  console.log(store.compact() ? "Database file shrunk." : "Could not shrink the database file (not enough free disk space?). Nothing was lost; it is tried again after the next cleanup.");
}
const collector = new Collector(riot, store, { platforms: config.collectPlatforms ?? ALL_PLATFORMS, tiers: config.collectTiers ?? TIERS, pages: config.collectPages, matchesPerPlayer: 20, recrawlMs: 6 * 3600_000, concurrency: config.collectConcurrency, timelineShare: config.collectTimelines, backfillEvery: config.collectBackfill ? 4 : 0 });
const app = await buildApp({ riot, cache, dd: ddLoader(), store, collector, defaultPlatform: config.platform });
await app.listen({ host: "127.0.0.1", port: config.port }); // localhost only: nobody else on your network can reach it
console.log(`Apex API running on http://127.0.0.1:${config.port} (platform ${config.platform}, limits ${config.ratePerSecond}/s and ${config.ratePer2Min}/2min). The API key is not printed.`);
if (config.autoCollect) { collector.start(); console.log(`Collector started: ${collector.cfg.platforms.length} regions x ${collector.cfg.tiers.length} ranks, ${collector.cfg.concurrency} workers. Pause it any time from Settings.`); }
else console.log("Collector is disabled (COLLECT_DISABLED=1). Resume it from Settings.");

try { process.loadEnvFile(".env"); } catch { /* .env is optional (tests, CI) */ }
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);
export const config = {
  riotKey: (process.env.RIOT_API_KEY ?? "").trim(),
  platform: (process.env.RIOT_PLATFORM ?? "euw1").trim().toLowerCase(),
  port: num(process.env.PORT, 8787),
  dbPath: process.env.DB_PATH ?? "apex.db",
  ratePerSecond: num(process.env.RATE_PER_SECOND, 20),
  ratePer2Min: num(process.env.RATE_PER_2MIN, 100),
  // The collector starts with the backend and covers every region and rank. COLLECT_DISABLED=1 turns that off.
  autoCollect: process.env.COLLECT_DISABLED !== "1",
  collectConcurrency: Math.max(1, Math.floor(num(process.env.COLLECT_CONCURRENCY, 16))),
  // Share of each rate-limit window the collector may use (0.1 to 0.95). The rest stays free for the app itself.
  collectShare: Math.min(0.95, Math.max(0.1, num(process.env.COLLECT_SHARE, 0.8))),
  // Optional restriction (comma-separated). Leave unset to collect everything.
  collectPlatforms: process.env.COLLECT_ONLY_PLATFORMS ? process.env.COLLECT_ONLY_PLATFORMS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : null,
  collectTiers: process.env.COLLECT_ONLY_TIERS ? process.env.COLLECT_ONLY_TIERS.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null,
  collectPages: num(process.env.COLLECT_PAGES, 1),
  // Share of collected games that also get their timeline (skill order, starting items, build order). Each costs one extra Riot request, so 0.25 slows collection by about a fifth. 0 = off.
  collectTimelines: Math.min(1, Math.max(0, num(process.env.COLLECT_TIMELINES, 0.25))),
};

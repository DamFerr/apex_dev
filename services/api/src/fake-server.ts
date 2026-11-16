/** TEST ONLY: the real API with a fake Riot behind it, so end-to-end tests can run without a key or internet. Port 8788. */
import { buildApp } from "./app";
import { HttpError } from "./riot";
import { fakeDD, fakeRiot, idleCollector, memoryCache, diverseStore } from "./testkit";

const riot = fakeRiot(), account = riot.account;
riot.account = async (n, t, r) => {
  if (n === "Fresh Player") return { puuid: "fresh-p", gameName: n, tagLine: t };       // a player Apex has never looked up: LP history starts empty
  if (n === "Na Player") return { puuid: "na-p", gameName: n, tagLine: t };           // a player who lives on another region
  try { return await account(n, t, r); } catch { throw new HttpError(404, "Not found on Riot's servers"); }
};
const ids = riot.matchIds, sm = riot.summoner;
riot.matchIds = async (p, region, ...rest) => (p === "na-p" ? (region === "americas" ? ["NA1_9"] : []) : ids(p, region, ...rest)); // only the americas cluster has her games
riot.summoner = async (p, pf) => (p === "na-p" ? { summonerLevel: 77 } : sm(p, pf));
const store = diverseStore();
// LP history fixture for the default test player (p0): four earlier checks, including a promotion from Platinum I into Emerald. The first lookup adds "Emerald II 64 LP, 87W 79L".
const DAY = 86_400_000;
for (const [tier, division, lp, wins, losses, daysAgo] of [["PLATINUM", "I", 80, 60, 60, 9], ["EMERALD", "IV", 20, 64, 62, 7], ["EMERALD", "III", 55, 70, 65, 5], ["EMERALD", "II", 40, 85, 79, 2]] as const)
  store.saveRankSnapshot("p0", { tier, division, lp, wins, losses }, Date.now() - daysAgo * DAY);
const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
await app.listen({ host: "127.0.0.1", port: 8788 });
console.log("Fake-Riot test API on 8788");

import { DatabaseSync } from "./sqlite";
import { makeCache, type Cache } from "./db";
import type { DD } from "./ddragon";
import { makeStore, type Store } from "./store";
import { Collector } from "./collector";
import { HttpError, type RiotActiveGame, type RiotApi, type RiotMatch, type RiotParticipant, type RiotTimeline, type RiotTimelineEvent } from "./riot";
import { extractTimeline } from "./timeline";

export const memoryCache = (): Cache => makeCache(new DatabaseSync(":memory:"));
export const participant = (i: number, over: Partial<RiotParticipant> = {}): RiotParticipant => ({ puuid: `p${i}`, riotIdGameName: `Player${i}`, championName: ["Ahri", "Jinx", "Thresh", "Garen", "LeeSin", "Lux", "Zed", "Ashe", "Ornn", "Yasuo"][i], teamId: i < 5 ? 100 : 200,
  teamPosition: ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][i % 5], win: i < 5, kills: i, deaths: 2, assists: 3, totalMinionsKilled: 100 + i, neutralMinionsKilled: 10, totalDamageDealtToChampions: 10000 + i, goldEarned: 9000, visionScore: 20,
  item0: 3157, item1: 3020, item2: i % 2 ? 3089 : 3157, item3: 1055, item4: 3100, item5: 3089, item6: 3340, summoner1Id: 4, summoner2Id: 14,
  perks: { styles: [{ style: i % 2 ? 8100 : 8000, selections: [{ perk: i % 2 ? 8112 : 8005 }, { perk: 8126 }, { perk: 8139 }, { perk: 8135 }] }, { style: i % 2 ? 8300 : 8200, selections: [{ perk: 8304 }, { perk: 8347 }] }], statPerks: { offense: 5008, flex: 5008, defense: 5011 } }, ...over });
export const matchFixture = (id: string, over: Partial<RiotMatch["info"]> = {}, blueWin = true): RiotMatch => ({ metadata: { matchId: id },
  info: { gameDuration: 1800, gameCreation: 1_700_000_000_000, gameEndTimestamp: 1_700_001_800_000, queueId: 420, gameVersion: "26.22.100.1",
    participants: Array.from({ length: 10 }, (_, i) => participant(i, { win: (i < 5) === blueWin })),
    teams: [{ teamId: 100, bans: [{ championId: 103 }, { championId: 0 }] }, { teamId: 200, bans: [{ championId: 222 }] }], ...over } });
/** A timeline where every player maxes Q, then E, then W; starts Doran's Blade + 2 potions + trinket; buys boots, misclicks Lich Bane (undone), then Zhonya, Rabadon, Lich Bane. */
export const timelineFixture = (): RiotTimeline => {
  const skills = [1, 2, 3, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2];
  const events: RiotTimelineEvent[] = Array.from({ length: 10 }, (_, i) => i + 1).flatMap((pid) => [
    ...skills.map((skillSlot, n): RiotTimelineEvent => ({ type: "SKILL_LEVEL_UP", timestamp: 60_000 + n * 60_000, participantId: pid, skillSlot, levelUpType: "NORMAL" })),
    { type: "ITEM_PURCHASED", timestamp: 1000, participantId: pid, itemId: 1055 }, { type: "ITEM_PURCHASED", timestamp: 1500, participantId: pid, itemId: 2003 }, { type: "ITEM_PURCHASED", timestamp: 1600, participantId: pid, itemId: 2003 },
    { type: "ITEM_PURCHASED", timestamp: 2000, participantId: pid, itemId: 3340 },
    { type: "ITEM_PURCHASED", timestamp: 600_000, participantId: pid, itemId: 3020 }, { type: "ITEM_PURCHASED", timestamp: 700_000, participantId: pid, itemId: 3100 }, { type: "ITEM_UNDO", timestamp: 701_000, participantId: pid, beforeId: 3100, afterId: 0 },
    { type: "ITEM_PURCHASED", timestamp: 900_000, participantId: pid, itemId: 3157 }, { type: "ITEM_PURCHASED", timestamp: 1_200_000, participantId: pid, itemId: 3089 }, { type: "ITEM_PURCHASED", timestamp: 1_500_000, participantId: pid, itemId: 3100 },
  ]);
  return { metadata: { participants: Array.from({ length: 10 }, (_, i) => `p${i}`) }, info: { frames: [{ events }] } };
};
export const fakeDD = async (): Promise<DD> => ({
  champs: new Map([[103, { id: "Ahri", name: "Ahri", tags: ["Mage"] }], [222, { id: "Jinx", name: "Jinx", tags: ["Marksman"] }], [412, { id: "Thresh", name: "Thresh", tags: ["Support"] }],
    [86, { id: "Garen", name: "Garen", tags: ["Fighter"] }], [64, { id: "LeeSin", name: "Lee Sin", tags: ["Fighter"] }],
    [99, { id: "Lux", name: "Lux", tags: ["Mage"] }], [238, { id: "Zed", name: "Zed", tags: ["Assassin"] }], [22, { id: "Ashe", name: "Ashe", tags: ["Marksman"] }], [516, { id: "Ornn", name: "Ornn", tags: ["Tank"] }], [157, { id: "Yasuo", name: "Yasuo", tags: ["Fighter"] }], [9, { id: "Fiddlesticks", name: "Fiddlesticks", tags: ["Mage"] }]]),
  items: new Map([[3157, { name: "Zhonya's Hourglass", total: 3250, hasUpgrade: false }], [3020, { name: "Sorcerer's Shoes", total: 1100, hasUpgrade: false, boots: true }], [3089, { name: "Rabadon's Deathcap", total: 3600, hasUpgrade: false }],
    [1055, { name: "Doran's Blade", total: 450, hasUpgrade: true }], [2003, { name: "Health Potion", total: 50, hasUpgrade: false }], [3100, { name: "Lich Bane", total: 3000, hasUpgrade: false }], [3340, { name: "Stealth Ward", total: 0, hasUpgrade: false }]]),
  runes: new Map([[8112, "Electrocute"], [8005, "Press the Attack"]]),
});
/** A store with 40 varied ranked games, so stats endpoints have something to aggregate. */
export function seededStore(db = new DatabaseSync(":memory:")): Store {
  const store = makeStore(db);
  for (let n = 0; n < 40; n++) { store.saveMatch(matchFixture(`EUW1_${n}`, {}, n % 3 !== 0), "EMERALD", "euw1"); store.saveTimeline(`EUW1_${n}`, extractTimeline(timelineFixture())); } // blue side wins 2 of 3
  return store;
}
/** seededStore plus 20 older-patch Diamond games on North America, so region, patch and rank filters have something to separate. */
export function diverseStore(): Store {
  const store = seededStore();
  for (let n = 0; n < 20; n++) store.saveMatch(matchFixture(`NA1_${n}`, { gameVersion: "26.21.9.9", gameEndTimestamp: 1_600_000_000_000 + n }, n % 2 === 0), "DIAMOND", "na1");
  return store;
}
export const idleCollector = (riot: RiotApi, store: Store) => new Collector(riot, store, { platforms: ["euw1"], tiers: ["EMERALD"], pages: 1, matchesPerPlayer: 5, recrawlMs: 1000, concurrency: 1 });

/** A live game: p0..p4 blue, p5..p9 red, p4 (Lee Sin) carries Smite, one bot-free lobby, one ban of Ahri and one empty ban slot. */
export const activeGameFixture = (): RiotActiveGame => ({ gameId: 1, gameMode: "CLASSIC", gameLength: 372, gameQueueConfigId: 420,
  participants: [103, 222, 412, 86, 64, 99, 238, 22, 516, 157].map((championId, i) => ({ puuid: `p${i}`, riotId: `Player${i}#EUW`, teamId: i < 5 ? 100 : 200, championId, spell1Id: i === 4 || i === 8 ? 11 : 4, spell2Id: 14 })),
  bannedChampions: [{ championId: 103, teamId: 100 }, { championId: -1, teamId: 200 }, { championId: 222, teamId: 200 }] });

/** Fake Riot that counts calls, so tests can prove caching works. */
export function fakeRiot(): RiotApi & { calls: Record<string, number> } {
  const calls: Record<string, number> = {}, hit = (k: string) => { calls[k] = (calls[k] ?? 0) + 1; };
  return { calls,
    account: async (name, tag) => { hit("account"); if (name === "Nobody") throw Object.assign(new Error("x"), { status: 404 }) as never; return { puuid: name === "Offline" ? "p-offline" : "p0", gameName: name, tagLine: tag }; },
    summoner: async () => { hit("summoner"); return { summonerLevel: 321 }; },
    league: async (puuid) => { hit("league"); return [{ queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 1, wins: 1, losses: 1 }, { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 64, wins: 87, losses: 79, hotStreak: puuid === "p1" }]; },
    ladder: async () => { hit("ladder"); return [{ puuid: "p0", tier: "EMERALD", rank: "II", leaguePoints: 10 }, { puuid: "p1", tier: "EMERALD", rank: "II", leaguePoints: 20 }, { tier: "EMERALD", rank: "II", leaguePoints: 30 }]; },
    matchIds: async (_p, _r, start, count) => { hit("matchIds"); return Array.from({ length: Math.min(count, 25 - start) }, (_, i) => `EUW1_${start + i}`); },
    match: async (id) => { hit("match"); return matchFixture(id); },
    timeline: async () => { hit("timeline"); return timelineFixture(); },
    activeGame: async (puuid) => { hit("activeGame"); if (puuid === "p-offline") throw new HttpError(404, "Not found on Riot's servers"); return activeGameFixture(); },
    mastery: async () => { hit("mastery"); return [{ championId: 103, championLevel: 10, championPoints: 250000 }, { championId: 999999, championLevel: 5, championPoints: 1 }]; },
  };
}

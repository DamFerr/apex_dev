import { describe, expect, it } from "vitest";
import { queueName, toLoadout, toMastery, toMatchDetail, toMatchSummary, toRank } from "./mapping";
import { matchFixture, participant } from "./testkit";

describe("mapping", () => {
  it("picks the solo queue entry as the rank and returns null when unranked", () => {
    expect(toRank([{ queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 64, wins: 87, losses: 79 }])).toEqual({ tier: "EMERALD", division: "II", lp: 64, wins: 87, losses: 79 });
    expect(toRank([{ queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 1, wins: 1, losses: 1 }])).toBeNull();
    expect(toRank([])).toBeNull();
  });
  it("summarises a match from the player's point of view", () => {
    const s = toMatchSummary(matchFixture("EUW1_1"), "p2")!;
    expect(s).toMatchObject({ id: "EUW1_1", champion: "Thresh", role: "MID", win: true, kills: 2, cs: 112, durationSec: 1800, queue: "Ranked Solo" });
    expect(s.playedAt).toBe(new Date(1_700_001_800_000).toISOString());
    expect(toMatchSummary(matchFixture("EUW1_1"), "someone-else")).toBeNull();
  });
  it("maps roles and handles modes without roles (ARAM)", () => {
    const m = matchFixture("x", { queueId: 450, participants: [participant(0, { teamPosition: "" }), participant(1, { teamPosition: "UTILITY" })] });
    expect(toMatchSummary(m, "p0")?.role).toBeNull();
    expect(toMatchSummary(m, "p1")?.role).toBe("SUPPORT");
    expect(queueName(450)).toBe("ARAM");
    expect(queueName(9999)).toBe("Queue 9999");
  });
  it("builds a scoreboard with teams, the winner, you, and unique names", () => {
    const d = toMatchDetail(matchFixture("EUW1_1", { participants: [participant(0, { riotIdGameName: "Dup" }), participant(1, { riotIdGameName: "Dup" }), ...Array.from({ length: 8 }, (_, i) => participant(i + 2))] }), "p0");
    expect(d.participants).toHaveLength(10);
    expect(d.blueWon).toBe(true);
    expect(d.participants.filter((p) => p.team === "blue")).toHaveLength(5);
    expect(d.participants.filter((p) => p.isYou).map((p) => p.name)).toEqual(["Dup"]);
    expect(new Set(d.participants.map((p) => p.name)).size).toBe(10);
  });
  it("names mastery champions and skips unknown ones", () => {
    const champs = new Map([[103, { id: "Ahri", name: "Ahri" }]]);
    expect(toMastery([{ championId: 103, championLevel: 7, championPoints: 5 }, { championId: 1, championLevel: 1, championPoints: 1 }], champs)).toEqual([{ champion: "Ahri", name: "Ahri", level: 7, points: 5 }]);
  });
});

import { toLiveGame, toRecap, perGame } from "./mapping";
import { HttpError } from "./riot";
describe("toLiveGame", () => {
  const champs = new Map([[103, { id: "Ahri", name: "Ahri" }]]);
  const base = { gameId: 1, gameMode: "CLASSIC", gameLength: -5, participants: [
    { puuid: "me", riotId: "Me#EUW", teamId: 100, championId: 103, spell1Id: 11, spell2Id: 4 },
    { riotId: "", teamId: 200, championId: 9999, bot: true }] };
  it("handles bots, unknown champions, missing ranks and a negative game length", () => {
    const g = toLiveGame(base, { youPuuid: "me", champs, entries: new Map(), pop: new Map() });
    expect(g.lengthSec).toBe(0); expect(g.queue).toBe("CLASSIC");
    expect(g.players[0]).toMatchObject({ champion: "Ahri", isYou: true, jungle: true, rank: null, champGames: 0 });
    expect(g.players[1]).toMatchObject({ riotId: "Bot", championName: "Champion 9999", team: "red", isYou: false, jungle: false });
  });
  it("uses the queue name when the queue id is known", () => {
    expect(toLiveGame({ ...base, gameQueueConfigId: 450 }, { youPuuid: "x", champs, entries: new Map(), pop: new Map() }).queue).toBe("ARAM");
  });
});

describe("toRecap", () => {
  const m = matchFixture("EUW1_1"), names = new Map([["Ahri", "Ahri"]]);
  it("throws a 404 when the player was not in the match", () => {
    expect(() => toRecap(m, "nobody", { names, baseline: null, personal: [] })).toThrow(HttpError);
  });
  it("hides the personal comparison below 3 games and shows the mean from 3", () => {
    const g = (kda: number) => ({ kda, cs: 5, damage: 400, gold: 350 });
    expect(toRecap(m, "p0", { names, baseline: null, personal: [g(1), g(2)] }).personal).toBeNull();
    const r = toRecap(m, "p0", { names, baseline: null, personal: [g(1), g(2), g(6)] });
    expect(r.personal).toEqual({ games: 3 }); expect(r.metrics[0].vsYou).toBeCloseTo(3, 6);
  });
  it("computes per-minute numbers and guards against zero deaths", () => {
    const p = participant(0, { kills: 4, assists: 6, deaths: 0, totalMinionsKilled: 200, neutralMinionsKilled: 10, totalDamageDealtToChampions: 21000, goldEarned: 15000 });
    expect(perGame(p, 1800)).toEqual({ kda: 10, cs: 7, damage: 700, gold: 500 });
  });
});

describe("toLoadout", () => {
  it("keeps the six item slots without empty ones, the trinket, the spells and the keystone and secondary tree", () => {
    const l = toLoadout(participant(0, { item0: 3157, item1: 0, item2: 3089, item3: 0, item4: 0, item5: 3100, item6: 3340 }));
    expect(l).toEqual({ items: [3157, 3089, 3100], trinket: 3340, spells: [4, 14], keystone: 8005, secondaryStyle: 8200 });
  });
  it("uses null for a missing trinket, keystone or secondary tree and tolerates missing fields", () => {
    const l = toLoadout(participant(0, { item6: 0, perks: undefined, summoner1Id: undefined }));
    expect(l).toMatchObject({ trinket: null, keystone: null, secondaryStyle: null, spells: [14] });
    expect(toLoadout(participant(0, { perks: { styles: [{ selections: [] }] } })).keystone).toBeNull();
  });
  it("is part of every player of the match detail and of the recap", () => {
    const d = toMatchDetail(matchFixture("EUW1_9"), "p1");
    expect(d.participants).toHaveLength(10);
    expect(d.participants[1].loadout).toMatchObject({ trinket: 3340, keystone: 8112, secondaryStyle: 8300, spells: [4, 14] });
    expect(d.participants.every((p) => p.loadout.items.length > 0)).toBe(true);
  });
  it("uses the Data Dragon spelling of champion ids (Riot sends FiddleSticks)", () => {
    const m = matchFixture("EUW1_1", { participants: [participant(0, { championName: "FiddleSticks" }), ...Array.from({ length: 9 }, (_, i) => participant(i + 1))] });
    expect(toMatchSummary(m, "p0")!.champion).toBe("Fiddlesticks");
    expect(toMatchDetail(m, "p0").participants[0].champion).toBe("Fiddlesticks");
  });
});

import { describe, expect, it } from "vitest";
import type { RecapMetric } from "@apex/schema";
import { performanceScore } from "@apex/stats-core";
import { gradeAgainst, LOW_OWN_GAMES, LOW_RANK_GAMES } from "./grade";
import { toRecap } from "./mapping";
import { matchFixture, participant } from "./testkit";

const metric = (id: RecapMetric["id"], you: number, vsRank: number | null, vsYou: number | null = null): RecapMetric => ({ id, label: id, unit: "", you, vsRank, vsYou, lobbyRank: 1 });
const four = (k: number, r: number | null) => [metric("kda", 4 * k, r === null ? null : 4 * r), metric("cs", 6 * k, r === null ? null : 6 * r), metric("damage", 500 * k, r === null ? null : 500 * r), metric("gold", 400 * k, r === null ? null : 400 * r)];

describe("gradeAgainst", () => {
  it("is 50 (a B, as everywhere in the app) when every measure equals the reference", () => expect(gradeAgainst(four(1, 1), "vsRank", 80, 50)).toEqual({ score: 50, letter: "B", games: 80, low: false, measures: 4 }));
  it("uses the shared stats-core score: 1.5x on every measure is about 88 (an S), half is low", () => {
    expect(gradeAgainst(four(1.5, 1), "vsRank", 80, 50)).toMatchObject({ score: performanceScore([1.5, 1.5, 1.5, 1.5]), letter: "S" });
    expect(gradeAgainst(four(1.5, 1), "vsRank", 80, 50)!.score).toBe(88);
    expect(gradeAgainst(four(0.5, 1), "vsRank", 80, 50)!.score).toBeLessThan(15); expect(gradeAgainst(four(0.5, 1), "vsRank", 80, 50)!.letter).toBe("D");
  });
  it("needs 3 of the 4 measures: 3 grades, 2 does not, and a zero or missing reference does not count", () => {
    const m = four(1.2, 1); m[3].vsRank = null;
    expect(gradeAgainst(m, "vsRank", 80, 50)!.measures).toBe(3);
    m[2].vsRank = 0; expect(gradeAgainst(m, "vsRank", 80, 50)).toBeNull();
    expect(gradeAgainst(four(1, null), "vsRank", 80, 50)).toBeNull();
  });
  it("flags few games behind the reference as low, per reference", () => {
    expect(gradeAgainst(four(1, 1), "vsRank", 49, LOW_RANK_GAMES)!.low).toBe(true); expect(gradeAgainst(four(1, 1), "vsRank", 50, LOW_RANK_GAMES)!.low).toBe(false);
    const own = four(1, 1).map((x) => ({ ...x, vsYou: x.vsRank }));
    expect(gradeAgainst(own, "vsYou", 4, LOW_OWN_GAMES)!.low).toBe(true); expect(gradeAgainst(own, "vsYou", 5, LOW_OWN_GAMES)!.low).toBe(false);
    expect(gradeAgainst(four(1, 1), "vsYou", 4, LOW_OWN_GAMES)).toBeNull();
  });
});

describe("toRecap grade", () => {
  const m = matchFixture("EUW1_1"), names = new Map([["Ahri", "Ahri"]]);
  const me = participant(0), mine = { kda: (me.kills + me.assists) / Math.max(1, me.deaths), cs: (me.totalMinionsKilled + me.neutralMinionsKilled) / 30, damage: me.totalDamageDealtToChampions / 30, gold: me.goldEarned / 30 };
  it("grades against the rank baseline and your own games separately; each is null without its reference", () => {
    expect(toRecap(m, "p0", { names, baseline: null, personal: [] }).grade).toEqual({ vsRank: null, vsYou: null });
    const g = toRecap(m, "p0", { names, baseline: { label: "x", avg: mine, games: 120 }, personal: [mine, mine, mine] }).grade!;
    expect(g.vsRank).toEqual({ score: 50, letter: "B", games: 120, low: false, measures: 4 }); expect(g.vsYou).toEqual({ score: 50, letter: "B", games: 3, low: true, measures: 4 });
  });
  it("two own games are below the recap's own minimum, so there is no personal grade", () => expect(toRecap(m, "p0", { names, baseline: null, personal: [mine, mine] }).grade!.vsYou).toBeNull());
});

describe("GET /v1/players/:riotId/recap grade", () => {
  it("carries a grade object: against the Emerald baseline (40 games, so a 'low' line of 50 applies) and your own games", async () => {
    const { buildApp } = await import("./app"), t = await import("./testkit"), riot = t.fakeRiot(), store = t.seededStore();
    const app = await buildApp({ riot, cache: t.memoryCache(), dd: t.fakeDD, store, collector: t.idleCollector(riot, store), defaultPlatform: "euw1" });
    const r = (await app.inject({ method: "GET", url: "/v1/players/Test%23EUW/recap" })).json();
    expect(r.grade).toBeDefined(); expect(r.grade.vsRank).toMatchObject({ games: r.baseline.games, measures: 4 });
    expect(r.grade.vsRank.score).toBeGreaterThanOrEqual(0); expect(r.grade.vsRank.score).toBeLessThanOrEqual(100);
    expect(r.grade.vsRank.low).toBe(r.baseline.games < 50);
  });
});

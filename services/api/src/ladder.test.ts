import { describe, expect, it } from "vitest";
import type { LadderRow } from "@apex/schema";
import { buildLadder, pageLadder, parseTiers } from "./ladder";
import type { ApexEntry } from "./riot";

const e = (lp: number, puuid: string | undefined = `p${lp}`): ApexEntry => ({ leaguePoints: lp, puuid, wins: 1, losses: 2 });
const list = (...lps: number[]) => ({ entries: lps.map((lp) => e(lp)) });

describe("buildLadder", () => {
  it("ranks all three lists together by LP and keeps each player's list as the tier without seats", () => {
    const rows = buildLadder("euw1", "solo", { challenger: list(900, 1200), grandmaster: list(650), master: list(300, 100) });
    expect(rows.map((r) => [r.rank, r.lp, r.tier])).toEqual([[1, 1200, "CHALLENGER"], [2, 900, "CHALLENGER"], [3, 650, "GRANDMASTER"], [4, 300, "MASTER"], [5, 100, "MASTER"]]);
    expect(rows[0]).toMatchObject({ puuid: "p1200", wins: 1, losses: 2, hotStreak: false });
  });
  it("uses the seats for Solo/Duo (Riot's lists are stale) but not for Flex", () => {
    // oc1: 50 Challenger + 100 Grandmaster seats. Riot's lists still say 60 / 100 / 100: the 10 players at places 51 to 60 are Grandmaster now.
    const lps = Array.from({ length: 260 }, (_, i) => 2000 - i), at = (a: number, b: number) => ({ entries: lps.slice(a, b).map((lp) => e(lp)) });
    const lists = { challenger: at(0, 60), grandmaster: at(60, 160), master: at(160, 260) };
    const tiers = (rows: LadderRow[]) => [rows[49].tier, rows[50].tier, rows[149].tier, rows[150].tier];
    expect(tiers(buildLadder("oc1", "solo", lists))).toEqual(["CHALLENGER", "GRANDMASTER", "GRANDMASTER", "MASTER"]);
    expect(buildLadder("oc1", "solo", lists)[55].tier).toBe("GRANDMASTER");
    expect(buildLadder("oc1", "flex", lists)[55].tier).toBe("CHALLENGER");
  });
  it("falls back to the lists when there are fewer players than seats, and leaves out entries without a puuid", () => {
    const rows = buildLadder("na1", "solo", { challenger: { entries: [e(900), { leaguePoints: 800 }] }, grandmaster: list(700), master: list(500) });
    expect(rows.map((r) => [r.lp, r.tier])).toEqual([[900, "CHALLENGER"], [700, "GRANDMASTER"], [500, "MASTER"]]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe("parseTiers and pageLadder", () => {
  it("reads the tier filter and defaults to all", () => {
    expect(parseTiers("master,challenger")).toEqual(["CHALLENGER", "MASTER"]);
    expect(parseTiers(undefined)).toEqual(["CHALLENGER", "GRANDMASTER", "MASTER"]);
    expect(parseTiers("gold,,x")).toEqual(["CHALLENGER", "GRANDMASTER", "MASTER"]);
  });
  it("filters by tier, keeps the ladder rank and slices the page", () => {
    const rows = buildLadder("euw1", "solo", { challenger: list(900, 1200), grandmaster: list(650), master: list(300, 100) });
    const p = pageLadder(rows, ["MASTER", "GRANDMASTER"], 1, 2);
    expect(p.total).toBe(3); expect(p.entries.map((r) => [r.rank, r.lp])).toEqual([[4, 300], [5, 100]]);
    expect(pageLadder(rows, ["CHALLENGER"], 5, 10)).toEqual({ total: 2, entries: [] });
  });
});

import { describe, expect, it } from "vitest";
import type { MatchSummary } from "@apex/schema";
import { championPerformance, csPerMin, kdaOf, rolePerformance } from "./profileStats";

const m = (champion: string, role: MatchSummary["role"], win: boolean, k = 5, d = 5, a = 5, cs = 150, durationSec = 1800): MatchSummary =>
  ({ id: `${champion}${Math.random()}`, champion, role, win, kills: k, deaths: d, assists: a, cs, durationSec, queue: "Ranked Solo/Duo", playedAt: "2026-11-01T00:00:00Z" });

describe("championPerformance", () => {
  it("sums games, wins and KDA parts per champion, busiest first", () => {
    const r = championPerformance([m("Ahri", "MID", true, 10, 2, 8), m("Ahri", "MID", false, 2, 6, 4), m("Zed", "MID", true), m("Ahri", "MID", true, 6, 4, 6)]);
    expect(r.map((x) => x.champion)).toEqual(["Ahri", "Zed"]);
    expect(r[0]).toMatchObject({ games: 3, wins: 2, kills: 18, deaths: 12, assists: 18 });
  });
  it("breaks ties by wins, then by name, and is empty for no games", () => {
    expect(championPerformance([m("B", "TOP", false), m("A", "TOP", true)]).map((x) => x.champion)).toEqual(["A", "B"]);
    expect(championPerformance([m("B", "TOP", true), m("A", "TOP", true)]).map((x) => x.champion)).toEqual(["A", "B"]);
    expect(championPerformance([])).toEqual([]);
  });
});

describe("rolePerformance", () => {
  it("counts games and wins per role, most played first, and skips games without a role", () => {
    const r = rolePerformance([m("A", "JUNGLE", true), m("B", "SUPPORT", false), m("C", "JUNGLE", false), m("D", null, true), m("E", "JUNGLE", true)]);
    expect(r).toEqual([{ role: "JUNGLE", games: 3, wins: 2 }, { role: "SUPPORT", games: 1, wins: 0 }]);
  });
});

describe("kdaOf / csPerMin", () => {
  it("is null without deaths and (k+a)/d otherwise", () => { expect(kdaOf(5, 0, 5)).toBeNull(); expect(kdaOf(4, 2, 6)).toBe(5); });
  it("is CS over minutes, 0 without time", () => { expect(csPerMin(300, 1800)).toBe(10); expect(csPerMin(10, 0)).toBe(0); });
});

import { describe, expect, it } from "vitest";
import type { PostGameRecap, RecapMetric } from "@apex/schema";
import { gradeSummary, gradesOf } from "./recapGrade";

const metric = (id: RecapMetric["id"], you: number, vsRank: number | null, vsYou: number | null): RecapMetric => ({ id, label: id, unit: "", you, vsRank, vsYou, lobbyRank: 1 });
const recap = (over: Partial<PostGameRecap> = {}, k = 1.5): PostGameRecap => ({ matchId: "x", queue: "Ranked Solo/Duo", win: true, durationSec: 1800, playedAt: "2026-11-20T00:00:00Z", champion: "Ahri", championName: "Ahri", role: "MID",
  kills: 1, deaths: 1, assists: 1, killParticipation: 0.5, damageShare: 0.2, loadout: {} as never, baseline: { label: "x", games: 120 }, personal: { games: 4 },
  metrics: [metric("kda", 4 * k, 4, 4), metric("cs", 6 * k, 6, 6), metric("damage", 500 * k, 500, 500), metric("gold", 400 * k, 400, 400)], ...over });

describe("gradesOf", () => {
  it("returns the backend's grades, rank first, with the basis added", () => {
    const g = gradesOf(recap({ grade: { vsRank: { score: 71, letter: "A", games: 120, low: false, measures: 4 }, vsYou: { score: 40, letter: "C", games: 4, low: true, measures: 4 } } }));
    expect(g.map((x) => [x.basis, x.letter, x.low])).toEqual([["rank", "A", false], ["you", "C", true]]);
  });
  it("skips a reference the backend could not grade, and shows nothing when there is none", () => {
    expect(gradesOf(recap({ grade: { vsRank: null, vsYou: { score: 50, letter: "B", games: 6, low: false, measures: 4 } } })).map((x) => x.basis)).toEqual(["you"]);
    expect(gradesOf(recap({ grade: { vsRank: null, vsYou: null } }))).toEqual([]);
  });
  it("computes the same grade locally for an older backend without `grade`, with the low-data lines (50 and 5 games)", () => {
    const g = gradesOf(recap());
    expect(g.map((x) => [x.basis, x.score, x.letter, x.games, x.low])).toEqual([["rank", 88, "S", 120, false], ["you", 88, "S", 4, true]]);
    expect(gradesOf(recap({ baseline: null, personal: null }))).toEqual([]);
    expect(gradesOf(recap({ baseline: { label: "x", games: 49 } }))[0].low).toBe(true);
  });
  it("needs three measures with a reference, locally too", () => {
    const m = recap().metrics; m[0].vsRank = null; m[1].vsRank = null;
    expect(gradesOf(recap({ metrics: m })).map((x) => x.basis)).toEqual(["you"]);
  });
});
describe("gradeSummary", () => {
  it("states the games, low data, that the result is ignored and that it is an estimate", () => {
    const s = gradeSummary({ ...gradesOf(recap())[1] }); expect(s).not.toContain("Grade B"); expect(s).toMatch(/^Rated S/);
    expect(s).toContain("against your recent games (4 games, low data)"); expect(s).toContain("ignores whether you won"); expect(s).toContain("estimate");
    expect(gradeSummary({ ...gradesOf(recap())[0] })).not.toContain("low data");
  });
});

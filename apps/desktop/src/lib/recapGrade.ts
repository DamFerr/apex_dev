import { perfGrade, performanceScore } from "@apex/stats-core";
import type { GameGrade, PostGameRecap } from "@apex/schema";

export type GradeBasis = "rank" | "you";
export interface ShownGrade extends GameGrade { basis: GradeBasis }
/** The same lines the backend uses (see `services/api/src/grade.ts`): under 50 collected games, or under 5 of your own, is LOW DATA. */
const LOW_RANK_GAMES = 50, LOW_OWN_GAMES = 5, MIN_MEASURES = 3;
export const BASIS_LABEL: Record<GradeBasis, string> = { rank: "rank averages", you: "your recent games" };

/** Same maths as the backend, for a backend that predates `recap.grade`. */
function localGrade(r: PostGameRecap, basis: GradeBasis): GameGrade | null {
  const games = basis === "rank" ? r.baseline?.games : r.personal?.games;
  const ratios = r.metrics.flatMap((m) => { const ref = basis === "rank" ? m.vsRank : m.vsYou; return ref && ref > 0 ? [m.you / ref] : []; });
  const score = games === undefined || ratios.length < MIN_MEASURES ? null : performanceScore(ratios);
  return score === null || games === undefined ? null : { score, letter: perfGrade(score), games, low: games < (basis === "rank" ? LOW_RANK_GAMES : LOW_OWN_GAMES), measures: ratios.length };
}

/** Every grade of a recap that has a reference, rank first, then your own games. Empty = nothing to compare with (no grade is shown, never a guess). */
export function gradesOf(r: PostGameRecap): ShownGrade[] {
  return (["rank", "you"] as const).flatMap((basis) => { const g = r.grade ? (basis === "rank" ? r.grade.vsRank : r.grade.vsYou) : localGrade(r, basis); return g ? [{ ...g, basis }] : []; });
}

/** Tooltip and screen-reader text for one grade: what is compared, what is not, and how many games stand behind it. */
export function gradeSummary(g: ShownGrade): string {
  return `Rated ${g.letter}, ${g.score} out of 100 against ${BASIS_LABEL[g.basis]} (${g.games} ${g.games === 1 ? "game" : "games"}${g.low ? ", low data" : ""}). 50 is exactly average. It compares your KDA, CS, damage and gold per minute with that average, ignores whether you won, and is an estimate.`;
}

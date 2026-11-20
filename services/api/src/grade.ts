import { perfGrade, performanceScore } from "@apex/stats-core";
import type { GameGrade, RecapMetric } from "@apex/schema";

/** At least this many of the four measures must have a reference, or there is no grade (never a grade from one number). */
export const MIN_MEASURES = 3;
/** LOW DATA lines for the two references: the rank baseline follows the app-wide rule (under 50 games); your own games are at most 10, so 5 is the line. */
export const LOW_RANK_GAMES = 50, LOW_OWN_GAMES = 5;

/**
 * One game's grade against ONE reference (the rank average or your own average). The score and letter come from the same stats-core functions
 * the app already used (`performanceScore`, `perfGrade`: 50 = exactly average, an average game is a B), fed with game / reference per measure
 * (KDA, CS, damage and gold per minute). It compares numbers, not who deserved to win: the result is not an input. Pure.
 * Null when fewer than `MIN_MEASURES` measures have a usable reference.
 */
export function gradeAgainst(metrics: RecapMetric[], key: "vsRank" | "vsYou", games: number, lowBelow: number): GameGrade | null {
  const ratios = metrics.flatMap((m) => { const ref = m[key]; return ref !== null && ref > 0 ? [m.you / ref] : []; });
  if (ratios.length < MIN_MEASURES) return null;
  const score = performanceScore(ratios);
  return score === null ? null : { score, letter: perfGrade(score), games, low: games < lowBelow, measures: ratios.length };
}

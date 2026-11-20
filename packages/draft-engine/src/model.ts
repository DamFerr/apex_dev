import { shrink } from "@apex/stats-core";

/**
 * Every tunable number of the draft model lives here: the log-odds scale, the shrinkage priors, the comp penalties and
 * the uncertainty band. All are hand-set, not learned; changing one changes every layer that uses it, nowhere else.
 */

// ---- Scale -----------------------------------------------------------------------------------------------------
/** Log-odds to percentage points; the slope of the sigmoid at 50% is 1/4, so 1 log-odds ≈ 25 pp near an even game. Only valid near 50%. */
export const PP = 25;
export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const toPP = (z: number) => z * PP;

// ---- Shrinkage (virtual games pulling an observed rate toward what we expected) ---------------------------------
/** Layer A strength: a champion's win rate is pulled toward 50%. */
export const STRENGTH_PRIOR = 50;
/** Layer A matchups and synergies: a pairing is pulled toward what the two champions' own strengths already predict. */
export const PAIR_PRIOR = 30;
/** Layer D: your own record on a champion is pulled toward the population rate. */
export const PERSONAL_PRIOR = 15;

// ---- Layer B: scaling (win rate late minus early, E.2c) ------------------------------------------------------------
/** Games a champion needs in BOTH the early and the late bucket (in the role) before a scaling number exists. */
export const SCALING_MIN_GAMES = 20;
/** Virtual games pulling each bucket's win rate toward the champion's rate in that role. */
export const SCALING_PRIOR = 30;

// ---- Layer D: your champion pool ----------------------------------------------------------------------------------
/** Mastery counts three times as much as your recent games (owner request): it is long-term comfort, recent games are a small sample. */
export const MASTERY_WEIGHT = 0.75;
export const RECENT_WEIGHT = 1 - MASTERY_WEIGHT;
/** Mastery points at which comfort is 50%; it saturates (100k = 0.5, 300k = 0.75, 1M = 0.91). */
export const MASTERY_HALF_POINTS = 100_000;
/** Recent games (in the role) at which recent form is 50% trusted. */
export const RECENT_HALF_GAMES = 5;
/** Log-odds bonus at full mastery (about +10 pp near an even game; 300k points is about +5.5 pp). A comfort estimate, not a measured effect; large enough that mastery outweighs even a strong recent record. */
export const MASTERY_MAX_Z = 0.4;

/** A champion's win rate on its own, shrunk toward 50%. */
export const shrunkStrength = (wins: number, games: number, prior = STRENGTH_PRIOR) => shrink(wins, games, 0.5, prior);

/**
 * How far a pairing's observed record is from what `expectedLogit` predicts, in log-odds, after shrinkage.
 * 0 = exactly as predicted (or no games); with few games the result stays near 0.
 */
export function shrunkEdge(wins: number, games: number, expectedLogit: number, prior = PAIR_PRIOR): number {
  return logit(shrink(wins, games, sigmoid(expectedLogit), prior)) - expectedLogit;
}

// ---- Layer B: composition penalties (maximum log-odds lost per feature) -----------------------------------------
/** Damage balance: free up to this share of one damage type, full penalty at 100%. */
export const DAMAGE_FREE_SHARE = 0.75;
export const DAMAGE_BALANCE_MAX = 0.3;
export const FRONTLINE_MAX = 0.15;
export const CROWD_CONTROL_MAX = 0.1;

// ---- Confidence --------------------------------------------------------------------------------------------------
/** Uncertainty band (as a 0..1 win-probability half-width): 2 pp with all 10 picks locked, 12 pp with none. A heuristic, not a statistical interval. */
export const BAND_MIN = 0.02;
export const BAND_SPAN = 0.1;
export const confidenceBand = (lockedPicks: number, totalPicks = 10) =>
  BAND_MIN + (BAND_SPAN * Math.max(0, totalPicks - lockedPicks)) / totalPicks;

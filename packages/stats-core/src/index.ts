/** Win-rate math (plan section 4.3). Pure functions, no dependencies. */

/** Wilson score interval for a win rate. Returns [lower, upper] in 0..1. */
export function wilson(wins: number, games: number, z = 1.96): [number, number] {
  if (games <= 0) return [0, 1];
  const p = wins / games, z2 = z * z;
  const denom = 1 + z2 / games;
  const center = (p + z2 / (2 * games)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / games + z2 / (4 * games * games))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/**
 * Bayesian shrinkage with a Beta prior: pulls small samples toward the baseline.
 * `strength` = how many "virtual games" the prior is worth.
 */
export function shrink(wins: number, games: number, baseline = 0.5, strength = 20): number {
  return (wins + baseline * strength) / (games + strength);
}

/** z-score of an observed win rate against a baseline rate. */
export function zScore(wins: number, games: number, baseline = 0.5): number {
  if (games <= 0 || baseline <= 0 || baseline >= 1) return 0;
  return (wins / games - baseline) / Math.sqrt((baseline * (1 - baseline)) / games);
}

export type SampleBadge = "low" | "medium" | "high";
/** Sample-size badge so tiny samples are never presented as meaningful. */
export function sampleBadge(games: number): SampleBadge {
  return games < 50 ? "low" : games < 300 ? "medium" : "high";
}

/* ---------- Tier list scoring (plan section 3.3) ---------- */

export type Grade = "S+" | "S" | "A" | "B" | "C" | "D";
export interface TierInput { id: string; games: number; wins: number; bans: number }
export interface TierRow {
  id: string; games: number; wins: number; bans: number;
  /** Bayesian-shrunk win rate (0..1). */ winRate: number;
  /** Shrunk win rate minus the average of the list, in percentage points. */ delta: number;
  pickRate: number; banRate: number; score: number;
  grade: Grade | null;
}

/** A champion needs at least this many games in a role to appear in that role's tier list at all. */
export const MIN_GRADED_GAMES = 50;
/** ...and at least this share of the role's games (0.5%), so the bar rises together with the amount of collected data. */
export const MIN_ROLE_PICKRATE = 0.005;
/** Games a champion needs to be shown in a role's tier list, given all games played in that role. */
export const minListedGames = (roleGames: number) => Math.max(MIN_GRADED_GAMES, Math.ceil(roleGames * MIN_ROLE_PICKRATE));
/** Share of graded champions per grade, best first: top 5% S+, next 15% S, next 25% A, next 30% B, next 15% C, last 10% D. */
export const GRADE_CUTS: [Grade, number][] = [["S+", 0.05], ["S", 0.2], ["A", 0.45], ["B", 0.75], ["C", 0.9], ["D", 1]];

/**
 * Strength score. Win rate edge in percentage points (so +2 pp = 2), plus a presence bonus that grows with
 * pick + ban rate but flattens out (log), so a popular champion edges out an equally strong niche one without
 * popularity ever beating real strength. Weights are fixed for now; user-tunable weights come in Phase 3.
 */
export function tierScore(winRate: number, baseline: number, pickRate: number, banRate: number): number {
  return (winRate - baseline) * 100 + 0.8 * Math.log1p((pickRate + banRate) * 100);
}

/**
 * Turns raw champion counts into a graded, ranked list. `totalGames` is the denominator for pick and ban rates.
 * Champions below `minListedGames` are left out entirely: their win rates and even their role are too often wrong to show.
 */
export function buildTierList(inputs: TierInput[], totalGames: number, priorStrength = 50): TierRow[] {
  const games = inputs.reduce((s, c) => s + c.games, 0), wins = inputs.reduce((s, c) => s + c.wins, 0);
  const baseline = games > 0 ? wins / games : 0.5, minGames = minListedGames(games);
  const rows: TierRow[] = inputs.filter((c) => c.games >= minGames).map((c) => {
    const winRate = shrink(c.wins, c.games, baseline, priorStrength);
    const pickRate = totalGames > 0 ? c.games / totalGames : 0, banRate = totalGames > 0 ? c.bans / totalGames : 0;
    return { ...c, winRate, delta: (winRate - baseline) * 100, pickRate, banRate, score: tierScore(winRate, baseline, pickRate, banRate), grade: null };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  rows.forEach((r, i) => {
    const fraction = (i + 0.5) / rows.length;
    r.grade = GRADE_CUTS.find(([, cut]) => fraction <= cut)![0];
  });
  return rows;
}

/* ---------- Post-game performance (plan section 3.8) ---------- */

export type PerfGrade = "S" | "A" | "B" | "C" | "D";
/**
 * Overall performance 0..100 from per-metric ratios (your value / the baseline value; higher is better, 1 = exactly average).
 * Ratios are averaged in log space (so 2x and 0.5x cancel out), each is clamped to 0.2..5 so one freak number cannot dominate,
 * and the result is squashed with tanh: average = 50, consistently 1.5x the baseline is about 88, consistently 0.67x about 12.
 * Returns null when there is nothing valid to compare.
 */
export function performanceScore(ratios: number[]): number | null {
  const logs = ratios.filter((r) => Number.isFinite(r) && r >= 0).map((r) => Math.log(Math.min(5, Math.max(0.2, r))));
  if (logs.length === 0) return null;
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  return Math.round(50 + 50 * Math.tanh(mean / Math.log(1.5)));
}
export const perfGrade = (score: number): PerfGrade => (score >= 80 ? "S" : score >= 65 ? "A" : score >= 50 ? "B" : score >= 35 ? "C" : "D");

/* ---------- Matchup and synergy vs expected (plan sections 3.2 and 4.2) ---------- */

const EPS = 1e-6;
/** Log-odds of a probability (clamped so 0 and 1 stay finite). */
export const logit = (p: number) => { const c = Math.min(1 - EPS, Math.max(EPS, p)); return Math.log(c / (1 - c)); };
/** Inverse of logit. */
export const expit = (x: number) => 1 / (1 + Math.exp(-x));

/** Games and wins of something (a champion in a role, or a pair of champions). */
export interface Tally { games: number; wins: number }
export interface RelationStat {
  /** What the two champions' own win rates predict for this pairing (0..1). */ expected: number;
  /** Win rate shrunk toward `expected`, so a small sample cannot look like a real effect (0..1). */ observed: number;
  /** observed - expected in percentage points: + means the pairing does better than predicted. */ delta: number;
  /** Raw win rate and its 95% Wilson interval. */ raw: number; lo: number; hi: number;
}

/**
 * How a lane matchup or a duo does compared with what the two champions' overall win rates predict.
 * Each champion's rate is first shrunk toward 50% (so a champion with 5 games predicts nothing), then combined in log-odds space
 * (draft model layer A): a matchup predicts logit(own) - logit(opponent), a synergy logit(own) + logit(teammate).
 * The observed pair win rate is shrunk toward that prediction, so `delta` is 0 with no games and grows only as evidence does.
 */
export function relationStat(kind: "matchup" | "synergy", own: Tally, other: Tally, pair: Tally, strength = 50): RelationStat {
  const a = shrink(own.wins, own.games, 0.5, strength), b = shrink(other.wins, other.games, 0.5, strength);
  const expected = expit(kind === "matchup" ? logit(a) - logit(b) : logit(a) + logit(b));
  const observed = shrink(pair.wins, pair.games, expected, strength), [lo, hi] = wilson(pair.wins, pair.games);
  return { expected, observed, delta: (observed - expected) * 100, raw: pair.games ? pair.wins / pair.games : 0, lo, hi };
}

export * from "./ladder";

import { shrink } from "./index";

/** What one patch holds for one champion (in one role): its games and wins, its bans, and how many games the whole patch has (the pick and ban rate denominator). */
export interface PatchSample { games: number; wins: number; bans: number; matches: number }

/** Games a champion needs in EACH of the two patches before a win-rate change is shown. Below this the change would mostly be noise. */
export const MIN_DELTA_GAMES = 50;
/** Prior strength of the win rate shrinkage; the same as the win rates shown everywhere else (`rate()` in the UI). */
const PRIOR = 50;

export interface PatchDelta {
  /** Shrunk win rates (0..1) in the older and the newer patch. */
  prevWinRate: number; winRate: number;
  /** winRate - prevWinRate in percentage points; null when either patch has fewer than `minGames` games. */
  winDelta: number | null;
  /** 95% range of winDelta in percentage points (null together with winDelta). */
  winRange: [number, number] | null;
  /** True only when the 95% range excludes 0: the change is bigger than what luck alone usually produces. */
  significant: boolean;
  /** Pick and ban rates (0..1) and their change in percentage points. A rate needs no minimum, it is a count over the whole patch. */
  pickRate: number; prevPickRate: number; pickDelta: number;
  banRate: number; prevBanRate: number; banDelta: number;
}

const rateOf = (n: number, of: number) => (of > 0 ? n / of : 0);

/**
 * How a champion changed from the older patch (`prev`) to the newer one (`cur`).
 * The win rates are shrunk toward 50% exactly like every other win rate in Apex, so 3 wins in 3 games never looks like a 100% champion.
 * The 95% range uses the standard error of the difference of two proportions (raw rates, so it is not made too narrow by the shrinkage),
 * and a change counts as significant only when that range excludes 0. Both patches need `minGames` games for any win-rate change to be shown.
 */
export function patchDelta(prev: PatchSample, cur: PatchSample, minGames = MIN_DELTA_GAMES): PatchDelta {
  const p0 = shrink(prev.wins, prev.games, 0.5, PRIOR), p1 = shrink(cur.wins, cur.games, 0.5, PRIOR);
  const pickRate = rateOf(cur.games, cur.matches), prevPickRate = rateOf(prev.games, prev.matches);
  const banRate = rateOf(cur.bans, cur.matches), prevBanRate = rateOf(prev.bans, prev.matches);
  const base = { prevWinRate: p0, winRate: p1, pickRate, prevPickRate, pickDelta: (pickRate - prevPickRate) * 100, banRate, prevBanRate, banDelta: (banRate - prevBanRate) * 100 };
  if (prev.games < minGames || cur.games < minGames) return { ...base, winDelta: null, winRange: null, significant: false };
  const r0 = prev.wins / prev.games, r1 = cur.wins / cur.games;
  const se = Math.sqrt((r0 * (1 - r0)) / prev.games + (r1 * (1 - r1)) / cur.games) * 100, d = (p1 - p0) * 100;
  const range: [number, number] = [d - 1.96 * se, d + 1.96 * se];
  return { ...base, winDelta: d, winRange: range, significant: range[0] > 0 || range[1] < 0 };
}

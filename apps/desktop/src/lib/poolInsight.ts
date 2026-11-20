import type { PoolEntry } from "@apex/schema";

/** Fewer recent games than this and no pool verdict is given: two games on two champions say nothing about a pool. */
export const MIN_POOL_GAMES = 10;
/** One-trick: at least this many games and at least this share of the recent games. */
export const ONE_TRICK_MIN_GAMES = 6;
export const ONE_TRICK_SHARE = 0.5;
/** Share of the recent games on the top 3 champions: from FOCUSED_SHARE up the pool is focused, up to WIDE_SHARE it is wide. */
export const FOCUSED_SHARE = 0.7;
export const WIDE_SHARE = 0.45;
/** Mastery points from which an unplayed champion counts as "dusty" (a real investment, not a one-off try). */
export const DUSTY_MIN_POINTS = 20000;

export type PoolShape = "focused" | "balanced" | "wide";

export interface PoolInsight {
  /** Recent games the pool was counted over (the API counts the latest 20). */
  games: number;
  champions: number;
  /** Share (0..1) of those games on the 3 most played champions. */
  topShare: number;
  shape: PoolShape;
  oneTrick: PoolEntry | null;
  /** Up to 3 champions with high mastery and no recent game, most points first. */
  dusty: PoolEntry[];
}

/**
 * Champion pool analysis (P3.1), shown as chips on the Champion performance panel. Pure. Describes WHAT the player plays (spread, one-trick, neglected mastery);
 * it makes no claim about which champion is better: the pool window is ~20 games, always LOW DATA for win rates.
 * Returns null under MIN_POOL_GAMES recent games.
 */
export function poolInsight(pool: PoolEntry[]): PoolInsight | null {
  const played = pool.filter((p) => p.games > 0).sort((a, b) => b.games - a.games || b.wins - a.wins);
  const games = played.reduce((s, p) => s + p.games, 0);
  if (games < MIN_POOL_GAMES) return null;
  const topShare = played.slice(0, 3).reduce((s, p) => s + p.games, 0) / games;
  const shape: PoolShape = topShare >= FOCUSED_SHARE ? "focused" : topShare <= WIDE_SHARE ? "wide" : "balanced";
  const lead = played[0];
  return {
    games, champions: played.length, topShare, shape,
    oneTrick: lead.games >= ONE_TRICK_MIN_GAMES && lead.games / games >= ONE_TRICK_SHARE ? lead : null,
    dusty: pool.filter((p) => p.games === 0 && p.points >= DUSTY_MIN_POINTS).sort((a, b) => b.points - a.points).slice(0, 3),
  };
}

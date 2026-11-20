import { sampleBadge, shrink, wilson, type SampleBadge } from "./index";

/** One length bucket as the API reports it: [minSec, maxSec) in seconds, `maxSec` null = open-ended. */
export interface LengthInput { minSec: number; maxSec: number | null; games: number; wins: number }
export interface LengthPoint extends LengthInput {
  /** Minutes, for the axis: "<20", "20-25", "35+". */ label: string;
  /** Win rate shrunk toward the champion's own overall rate (0..1), so a thin bucket cannot look like a real effect. */ winRate: number;
  /** Wilson interval of the raw win rate (0..1). */ ci: [number, number];
  /** `winRate` minus the champion's overall rate (a correlation: games end early partly BECAUSE the champion is winning). */ delta: number;
  badge: SampleBadge;
}
export interface LengthCurve { games: number; baseline: number; points: LengthPoint[] }

const minutes = (sec: number) => Math.round(sec / 60);
export function lengthLabel(minSec: number, maxSec: number | null): string {
  if (minSec <= 0 && maxSec !== null) return `<${minutes(maxSec)}`;
  if (maxSec === null) return `${minutes(minSec)}+`;
  return `${minutes(minSec)}-${minutes(maxSec)}`;
}

/**
 * Win rate by game length. Each bucket is shrunk toward the champion's overall win rate over all buckets (50% with no games), not toward 50%,
 * so the curve shows how the champion's own rate moves with length. Pure; buckets keep their order.
 */
export function lengthCurve(buckets: LengthInput[], strength = 20): LengthCurve {
  const games = buckets.reduce((n, b) => n + b.games, 0), wins = buckets.reduce((n, b) => n + b.wins, 0), baseline = games > 0 ? wins / games : 0.5;
  return { games, baseline, points: buckets.map((b) => { const winRate = shrink(b.wins, b.games, baseline, strength);
    return { ...b, label: lengthLabel(b.minSec, b.maxSec), winRate, ci: wilson(b.wins, b.games), delta: winRate - baseline, badge: sampleBadge(b.games) }; }) };
}

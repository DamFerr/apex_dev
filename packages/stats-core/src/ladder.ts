/** Ladder math for LP history. Pure functions, no dependencies. */

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"] as const;
const DIVISIONS: Record<string, number> = { IV: 0, III: 1, II: 2, I: 3 };
const DIVISION_NAMES = ["IV", "III", "II", "I"] as const;
/** Master, Grandmaster and Challenger share one LP ladder with no divisions; it starts after the 7 tiers with divisions (7 x 400). */
export const APEX_TIER_BASE = TIERS.length * 400;
const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"];

/**
 * One number for "how high on the ladder": 400 per tier, 100 per division, plus LP. Iron IV 0 LP = 0, Emerald II 64 LP = 2264.
 * Master and above are one ladder (Master 0 LP = 2800), so a Master player's LP is simply added. Returns null for an unknown tier.
 * A difference of two values is the LP change you would see, including across promotions.
 */
export function ladderPoints(tier: string, division: string, lp: number): number | null {
  const t = tier.toUpperCase();
  if (APEX_TIERS.includes(t)) return APEX_TIER_BASE + lp;
  const i = (TIERS as readonly string[]).indexOf(t), d = DIVISIONS[division.toUpperCase()];
  if (i < 0 || d === undefined) return null;
  return i * 400 + d * 100 + lp;
}

const title = (s: string) => s[0] + s.slice(1).toLowerCase();

/** Readable rank for a ladder point value, e.g. 2264 -> "Emerald II · 64 LP"; at or above Master -> "Master+ · 120 LP". */
export function pointsLabel(points: number, showLp = true): string {
  if (points >= APEX_TIER_BASE) return `Master+${showLp ? ` · ${Math.round(points - APEX_TIER_BASE)} LP` : ""}`;
  const p = Math.max(0, points), tier = TIERS[Math.min(TIERS.length - 1, Math.floor(p / 400))], div = DIVISION_NAMES[Math.floor((p % 400) / 100)];
  return `${title(tier)} ${div}${showLp ? ` · ${Math.floor(p % 100)} LP` : ""}`;
}

export interface RankPoint { tier: string; division: string; lp: number; wins: number; losses: number }
export interface LpStep {
  /** Ranked games played between the two checks (wins + losses). */
  games: number; wins: number; losses: number;
  /** LP gained or lost between the two checks, null when it cannot be told. */
  lp: number | null;
  /** The win/loss counters went down: a new season (or a rank reset) started between the two checks, so no LP change is claimed. */
  reset: boolean;
}

/**
 * What happened between two rank checks. Several games can fall between two checks, so this is a total for the period, never per game.
 * Wins or losses going down means the ranked counters were reset (new season), which is reported as `reset` with no LP change.
 */
export function lpStep(prev: RankPoint, next: RankPoint): LpStep {
  const wins = next.wins - prev.wins, losses = next.losses - prev.losses;
  if (wins < 0 || losses < 0) return { games: 0, wins: 0, losses: 0, lp: null, reset: true };
  const a = ladderPoints(prev.tier, prev.division, prev.lp), b = ladderPoints(next.tier, next.division, next.lp);
  return { games: wins + losses, wins, losses, lp: a === null || b === null ? null : b - a, reset: false };
}

/** Y-axis ticks for a chart: multiples of a nice step (100, 200 or 400 points) covering [min, max], at most `max` of them. */
export function ladderTicks(min: number, max: number, count = 5): number[] {
  const span = Math.max(100, max - min);
  const step = [100, 200, 400, 800].find((s) => span / s <= count - 1) ?? 800;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step; v += step) out.push(v);
  return out;
}

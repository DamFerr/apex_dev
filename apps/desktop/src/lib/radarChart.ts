/**
 * Geometry of the skill radar (R.3). Pure, so it is unit tested without a DOM.
 * Axis 0 points straight up and the rest follow clockwise; `frac` is 0..1 of the radius (score / 100).
 */
import type { PlayerRadarAxisId } from "@apex/schema";

export const AXIS_LABEL: Record<PlayerRadarAxisId, string> = { fighting: "Fighting", farming: "Farming", damage: "Damage", economy: "Economy", vision: "Vision" };
/** What the number on each axis is, for the tooltips (fighting is KDA, the others are per minute). */
export const AXIS_UNIT: Record<PlayerRadarAxisId, string> = { fighting: "KDA", farming: "CS/min", damage: "damage/min", economy: "gold/min", vision: "vision/min" };

/** Damage and gold per minute are hundreds, so whole numbers; KDA, CS and vision keep one decimal. */
export const formatAxisValue = (id: PlayerRadarAxisId, v: number) => (id === "damage" || id === "economy" ? Math.round(v).toString() : v.toFixed(1));

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const round = (x: number) => Math.round(x * 100) / 100;

export function radarPoint(i: number, n: number, frac: number, cx: number, cy: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n, d = r * clamp01(frac);
  return [round(cx + d * Math.cos(a)), round(cy + d * Math.sin(a))];
}

/** Closed path through one point per axis. `fracs[i]` is the distance of axis i from the centre, 0..1. */
export function radarPath(fracs: number[], cx: number, cy: number, r: number): string {
  if (fracs.length === 0) return "";
  return fracs.map((f, i) => { const [x, y] = radarPoint(i, fracs.length, f, cx, cy, r); return `${i === 0 ? "M" : "L"}${x} ${y}`; }).join(" ") + " Z";
}

/** A grid ring at `frac` of the radius for `n` axes. */
export const ringPath = (n: number, frac: number, cx: number, cy: number, r: number) => radarPath(Array<number>(n).fill(frac), cx, cy, r);

/** Score 0..100 as a fraction of the radius. */
export const scoreFrac = (score: number) => clamp01(score / 100);

/** Text anchor for an axis label so it grows away from the chart instead of across it. */
export function labelAnchor(x: number, cx: number): "start" | "middle" | "end" {
  return x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle";
}

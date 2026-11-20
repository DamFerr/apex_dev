import type { PlayerRadar, PlayerRadarAxis } from "@apex/schema";

/** An axis counts as a strength or weakness only when its score is at least this far from 50 (the rank average). */
export const INSIGHT_MARGIN = 5;

export interface RadarInsight {
  kind: "strength" | "weakness";
  axis: PlayerRadarAxis;
  /** Player's value against the rank average in percent (+12 = 12% above). null when the average is 0. */
  diffPct: number | null;
}

const diff = (a: PlayerRadarAxis) => (a.reference > 0 ? Math.round(((a.value - a.reference) / a.reference) * 100) : null);

/**
 * Best and worst axis of a radar as a strength and a weakness (R.4). Pure.
 * Nothing under LOW DATA, without a reference, with under 3 axes, or when the axis is within the margin of the average:
 * a small gap is noise, and calling the "best" of five average axes a strength would overstate it. It is a comparison with an average, not a verdict.
 */
export function radarInsights(r: PlayerRadar): RadarInsight[] {
  if (r.low || r.reference === null || r.axes.length < 3) return [];
  const out: RadarInsight[] = [];
  const best = r.axes.find((a) => a.id === r.best), worst = r.axes.find((a) => a.id === r.worst);
  if (best && best.score >= 50 + INSIGHT_MARGIN) out.push({ kind: "strength", axis: best, diffPct: diff(best) });
  if (worst && worst.score <= 50 - INSIGHT_MARGIN) out.push({ kind: "weakness", axis: worst, diffPct: diff(worst) });
  return out;
}

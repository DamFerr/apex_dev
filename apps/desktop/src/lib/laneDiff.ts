import { sampleBadge } from "@apex/stats-core";
import type { LaneDiff } from "@apex/schema";

export type LaneMetric = "gold" | "cs" | "xp";
export const LANE_METRICS: { key: LaneMetric; label: string }[] = [{ key: "gold", label: "Gold" }, { key: "cs", label: "CS" }, { key: "xp", label: "XP" }];
export const LANE_MINUTES = [10, 15, 20] as const;
/** A lead smaller than this is shown muted (display threshold only, nothing is tested against it): about one kill's gold, two minions, or a fifth of a level. */
const NEUTRAL_BELOW: Record<LaneMetric, number> = { gold: 100, cs: 2, xp: 100 };

/** The entry for one minute, or undefined (no lane data, or no game reached that minute). */
export const laneAt = (lane: LaneDiff[] | undefined, minute: number): LaneDiff | undefined => lane?.find((d) => d.minute === minute);

/** "+312" / "−45" (a real minus sign); CS keeps one decimal, gold and XP are whole numbers. Zero has no sign. */
export function fmtLead(metric: LaneMetric, v: number): string {
  const text = Math.abs(v).toFixed(metric === "cs" ? 1 : 0);
  return `${Number(text) === 0 ? "" : v < 0 ? "\u2212" : "+"}${text}`;
}

/** Colour band of a lead. The sign is always printed too, so colour is never the only carrier. */
export const leadBand = (metric: LaneMetric, v: number): "good" | "bad" | "neutral" => (v >= NEUTRAL_BELOW[metric] ? "good" : v <= -NEUTRAL_BELOW[metric] ? "bad" : "neutral");

/** True when this cell rests on fewer games than the app's LOW DATA line (same rule as everywhere else). */
export const isLowLane = (d: LaneDiff): boolean => sampleBadge(d.games) === "low";

/** One sentence for the tooltip and the screen-reader text: all three measures, the games behind them, and what kind of number this is. */
export function laneSummary(name: string, d: LaneDiff): string {
  return `${name} at ${d.minute} min: gold ${fmtLead("gold", d.gold)}, CS ${fmtLead("cs", d.cs)}, XP ${fmtLead("xp", d.xp)}, average lead over ${d.games} ${d.games === 1 ? "game" : "games"}${isLowLane(d) ? " (low data)" : ""}. A correlation with winning, not a cause.`;
}

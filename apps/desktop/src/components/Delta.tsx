import { signed } from "./StatRows";

/**
 * A change in percentage points with a real minus sign. The sign carries the meaning, colour is only a hint:
 * `tone` is "good" / "bad" for a change that is clearly more than luck, "plain" for a plain change (pick and ban rate), "muted" for a noisy or missing one.
 */
export function Delta({ value, tone = "muted", title, decimals = 1 }: { value: number | null; tone?: "good" | "bad" | "plain" | "muted"; title?: string; decimals?: number }) {
  if (value === null) return <span className="text-muted" title={title}>–</span>;
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "plain" ? "text-text" : "text-muted";
  return <span className={`tabular-nums font-medium whitespace-nowrap ${color}`} title={title}>{Number(value.toFixed(decimals)) === 0 ? (0).toFixed(decimals) : signed(value, decimals)} pp</span>;
}

/** Colour for a win-rate change: only a change whose 95% range excludes 0 is coloured. */
export const winTone = (d: { winDelta: number | null; significant: boolean }): "good" | "bad" | "muted" => (d.winDelta === null || !d.significant ? "muted" : d.winDelta > 0 ? "good" : "bad");

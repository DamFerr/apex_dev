import { motion } from "framer-motion";
import { useMemo } from "react";
import { lengthCurve, type LengthPoint } from "@apex/stats-core";
import type { Role } from "@apex/schema";
import { InlineDelta } from "../components/Delta";
import { LowBadge, pct, wrClass } from "../components/StatRows";
import { Skeleton } from "../components/ui";
import { useChampionLengths } from "../lib/api";
import { lengthAxis } from "../lib/lengthAxis";
import { useUi } from "../lib/store";

/** Long explanations live in tooltips (with sr-only copies); the page keeps short lines. */
const LENGTH_TIP = "Win rate by game length is a correlation, not an effect: short games are often stomps or surrenders, and long games select for certain team comps. Each rate is Bayesian-adjusted toward this champion's own overall rate, so a thin bucket cannot look like a real swing. The change is coloured only when the 95% range of the raw rate excludes the overall rate.";
const ERROR_TIP = "Win rate by game length could not be loaded from the local backend.";
const EMPTY_TIP = "No collected games for this champion with these filters.";

/** Adjusted win rate per length bucket with its 95% Wilson range; hollow dots are low-data buckets. The axis is zoomed to the data. */
function Curve({ points, baseline }: { points: LengthPoint[]; baseline: number }) {
  const reduce = useUi((s) => s.reduceMotion);
  const W = 560, H = 120, PAD = 36, ys = points.map((p) => p.winRate * 100), { lo, hi } = lengthAxis(ys, baseline * 100);
  const y = (v: number) => 10 + ((hi - Math.min(hi, Math.max(lo, v))) / (hi - lo)) * (H - 36), x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, points.length - 1);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.winRate * 100).toFixed(1)}`).join(" ");
  const label = `Adjusted win rate by game length: ${points.map((p) => `${p.label} min ${(p.winRate * 100).toFixed(1)}%`).join(", ")}`;
  return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label={label}>
    <line x1={PAD} x2={W - PAD} y1={y(baseline * 100)} y2={y(baseline * 100)} stroke="rgb(var(--line) / .15)" strokeDasharray="4 4" />
    <text x={W - PAD + 4} y={y(baseline * 100) + 3} fontSize="10" fill="rgb(var(--muted))">{(baseline * 100).toFixed(1)}%</text>
    {points.map((p, i) => p.games > 0 && <line key={p.label} x1={x(i)} x2={x(i)} y1={y(p.ci[0] * 100)} y2={y(p.ci[1] * 100)} stroke="rgb(var(--accent) / .35)" strokeWidth={3} strokeLinecap="round" />)}
    <motion.path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth={2} strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.9, ease: "easeOut" }} />
    {points.map((p, i) => <g key={p.label}><circle cx={x(i)} cy={y(p.winRate * 100)} r={4} fill={p.badge === "low" ? "rgb(var(--base))" : "rgb(var(--accent))"} stroke="rgb(var(--accent))" strokeWidth={2} />
      <text x={x(i)} y={H - 4} fontSize="10" textAnchor="middle" fill="rgb(var(--muted))">{p.label}</text></g>)}
  </svg>);
}

/** Coloured only when the raw rate's 95% range excludes the champion's overall rate. */
const tone = (p: LengthPoint, baseline: number): "good" | "bad" | "muted" => (p.games === 0 ? "muted" : p.ci[0] > baseline ? "good" : p.ci[1] < baseline ? "bad" : "muted");

/** One champion's win rate by game length (under 20, 20-25, 25-30, 30-35, 35+ minutes) in the role chosen in `HistoryPanel`, with sample sizes. A correlation, and the tooltip says so. */
export function LengthPanel({ id, role }: { id: string; role?: Role }) {
  const { data, isLoading, isError } = useChampionLengths(id, role);
  const curve = useMemo(() => (data ? lengthCurve(data.buckets) : null), [data]);
  return (<div className="space-y-4 min-w-0" role="group" aria-label="Win rate by game length">
    <h3 className="font-display text-lg font-semibold" title={LENGTH_TIP}>Win rate by game length<span className="sr-only">. {LENGTH_TIP}</span></h3>
    {isLoading && <Skeleton className="h-40" />}
    {isError && <div className="text-sm text-muted" title={ERROR_TIP}>Game length unavailable<span className="sr-only">: {ERROR_TIP}</span></div>}
    {data && (!curve || curve.games === 0) && <div className="text-sm text-muted" title={EMPTY_TIP}>No games with these filters<span className="sr-only">: {EMPTY_TIP}</span></div>}
    {data && curve && curve.games > 0 && <>
      <Curve points={curve.points} baseline={curve.baseline} />
      <table className="w-full text-sm">
        <caption className="sr-only">Adjusted win rate of {id} in {data.role ?? "its role"} by game length in minutes, with the games in each bucket and the change from its overall rate of {pct(curve.baseline)} in brackets</caption>
        <thead className="text-xs text-muted"><tr><th className="text-left font-normal">Minutes</th><th className="font-normal text-right">Games</th><th className="font-normal text-right pl-2" title="Win rate adjusted for small samples, with the change from the champion's overall rate in brackets">Win rate</th></tr></thead>
        <tbody>{curve.points.map((p) => (<tr key={p.label} className="h-9 border-t border-line/5">
          <td className="whitespace-nowrap font-medium">{p.label}</td>
          <td className="text-right tabular-nums text-muted">{p.games.toLocaleString()}{p.games > 0 && <LowBadge games={p.games} />}</td>
          <td className="text-right whitespace-nowrap pl-2"><span className={`tabular-nums font-medium ${p.games === 0 ? "text-muted" : wrClass(p.winRate)}`} title={p.games ? `Raw ${pct(p.wins / p.games)}` : undefined}>{p.games === 0 ? "–" : pct(p.winRate)}</span>
            <InlineDelta value={p.games === 0 ? null : p.delta * 100} tone={tone(p, curve.baseline)} /></td></tr>))}</tbody>
      </table>
      <p className="text-[11px] text-muted" title={LENGTH_TIP}>(±) change vs overall {pct(curve.baseline)}, in pp · {curve.games.toLocaleString()} games · correlation<span className="sr-only">. {LENGTH_TIP}</span></p>
    </>}
  </div>);
}

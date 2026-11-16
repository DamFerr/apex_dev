import { motion } from "framer-motion";
import { useMemo } from "react";
import type { RankSnapshot } from "@apex/schema";
import { APEX_TIER_BASE, ladderPoints, ladderTicks, lpStep, pointsLabel } from "@apex/stats-core";
import { Skeleton } from "../components/ui";
import { useRankHistory } from "../lib/api";
import { useUi } from "../lib/store";

interface Pt { at: Date; pts: number; snap: RankSnapshot }
const day = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const stamp = (d: Date) => `${day(d)}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
/** Tier + division bucket (Master and above count as one), used to tell a promotion from a plain LP change. */
const bucket = (pts: number) => Math.floor(Math.min(pts, APEX_TIER_BASE) / 100);

const W = 760, H = 240, L = 112, R = 24, T = 16, B = 30;

function Chart({ pts }: { pts: Pt[] }) {
  const reduce = useUi((s) => s.reduceMotion);
  const lo0 = Math.min(...pts.map((p) => p.pts)), hi0 = Math.max(...pts.map((p) => p.pts));
  const ticks = ladderTicks(lo0, hi0), lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (i: number) => (pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const peak = pts.reduce((a, p, i) => (p.pts > pts[a].pts ? i : a), 0), last = pts.length - 1;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pts).toFixed(1)}`).join(" ");
  const summary = `LP history, ${pts.length} checks from ${day(pts[0].at)} to ${day(pts[last].at)}, from ${pointsLabel(pts[0].pts)} to ${pointsLabel(pts[last].pts)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={summary}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgb(var(--line) / .08)" />
          <text x={L - 10} y={y(t) + 4} textAnchor="end" className="fill-muted" fontSize="11">{t >= APEX_TIER_BASE ? pointsLabel(t) : pointsLabel(t, false)}</text>
        </g>))}
      {pts.length > 1 && <motion.path d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.1, ease: "easeOut" }} />}
      {pts.map((p, i) => (
        <circle key={p.snap.at} cx={x(i)} cy={y(p.pts)} r={i === last ? 5 : 3.5} fill={i === peak && pts.length > 1 ? "rgb(var(--gold))" : "rgb(var(--accent))"} stroke="rgb(var(--base))" strokeWidth={1.5}>
          <title>{`${stamp(p.at)} · ${pointsLabel(p.pts)} · ${p.snap.rank.wins}W ${p.snap.rank.losses}L`}</title>
        </circle>))}
      <text x={x(0)} y={H - 8} textAnchor={pts.length === 1 ? "middle" : "start"} className="fill-muted" fontSize="11">{day(pts[0].at)}</text>
      {pts.length > 1 && <text x={x(last)} y={H - 8} textAnchor="end" className="fill-muted" fontSize="11">{day(pts[last].at)}</text>}
    </svg>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (<div className="glass rounded-lg p-4"><div className="text-xs text-muted">{label}</div>
    <div className={`font-display text-xl font-semibold mt-1 tabular-nums ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</div>
    {hint && <div className="text-xs text-muted mt-1">{hint}</div>}</div>);
}

/** LP over time from the rank snapshots Apex recorded. Between two checks several games can have been played, so changes are totals for the period. */
export function LpHistoryTab({ id }: { id: string }) {
  const { data, isError, error } = useRankHistory(id);
  const pts = useMemo<Pt[]>(() => (data?.snapshots ?? []).flatMap((s) => { const v = ladderPoints(s.rank.tier, s.rank.division, s.rank.lp); return v === null ? [] : [{ at: new Date(s.at), pts: v, snap: s }]; }), [data]);
  if (isError) return <div className="glass rounded-lg p-5 mt-4 text-sm text-bad">{(error as Error).message}</div>;
  if (!data) return <div className="space-y-3 mt-4"><Skeleton className="h-20" /><Skeleton className="h-56" /></div>;
  if (!pts.length) return <div className="glass rounded-lg p-6 mt-4 text-sm text-muted">No ranked history yet. Apex records your Ranked Solo rank each time it looks you up, so it starts as soon as you have a rank (unranked players have none).</div>;

  const steps = pts.slice(1).map((p, i) => ({ to: p, from: pts[i], step: lpStep(pts[i].snap.rank, p.snap.rank) }));
  // The current season is everything after the last counter reset, so a new season never shows up as a fake LP drop.
  const seasonFrom = Math.max(0, steps.map((s) => s.step.reset).lastIndexOf(true) + 1), cur = pts.slice(seasonFrom);
  const first = cur[0], now = cur[cur.length - 1], net = now.pts - first.pts;
  const peak = cur.reduce((a, p) => (p.pts > a.pts ? p : a), cur[0]);
  const w = now.snap.rank.wins - first.snap.rank.wins, l = now.snap.rank.losses - first.snap.rank.losses;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Current" value={pointsLabel(now.pts)} hint={`${now.snap.rank.wins}W ${now.snap.rank.losses}L this season`} />
        <Stat label="Highest seen" value={pointsLabel(peak.pts)} hint={`on ${day(peak.at)}`} />
        <Stat label={`Since ${day(first.at)}`} value={cur.length > 1 ? `${signed(net)} LP` : "No change yet"} tone={cur.length > 1 ? (net >= 0 ? "good" : "bad") : undefined}
          hint={cur.length > 1 ? `${w + l} games (${w}W ${l}L)` : "Tracking just started"} />
      </div>
      <div className="glass rounded-lg p-4"><Chart pts={cur} />
        {cur.length === 1 && <p className="text-xs text-muted mt-2">Apex started tracking on {day(first.at)}. The graph grows each time your LP changes and you open Apex.</p>}</div>
      {steps.length > 0 && <div className="glass rounded-lg p-4">
        <h2 className="font-display text-base font-semibold mb-2">Changes</h2>
        <ul className="divide-y divide-line/10">{[...steps].reverse().slice(0, 30).map(({ to, from, step }) => (
          <li key={to.snap.at} className="h-10 flex items-center gap-4 text-sm">
            <span className="w-32 text-xs text-muted">{stamp(to.at)}</span>
            <span className="flex-1">{step.reset ? <span className="text-muted">New season: win and loss counters were reset, so no LP change is shown. Now {pointsLabel(to.pts)}</span> : <>
              {pointsLabel(to.pts)}{bucket(to.pts) > bucket(from.pts) && <span className="ml-2 text-xs text-good">Promoted</span>}{bucket(to.pts) < bucket(from.pts) && <span className="ml-2 text-xs text-bad">Demoted</span>}</>}</span>
            {!step.reset && <span className="w-24 text-xs text-muted text-right tabular-nums">{step.games ? `${step.wins}W ${step.losses}L` : "No games"}</span>}
            {!step.reset && step.lp !== null && <span className={`w-16 text-right tabular-nums font-medium ${step.lp >= 0 ? "text-good" : "text-bad"}`}>{signed(step.lp)} LP</span>}
          </li>))}</ul>
      </div>}
      <p className="text-xs text-muted">Apex records your rank each time it looks you up, so a change is the total since the previous check, not one game. History starts on {day(pts[0].at)} and is stored only on this device.</p>
    </div>
  );
}

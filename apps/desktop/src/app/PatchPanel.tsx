import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { MIN_DELTA_GAMES, patchDelta, shrink, wilson } from "@apex/stats-core";
import type { PatchPoint, Role } from "@apex/schema";
import { Delta, winTone } from "../components/Delta";
import { RoleIcon } from "../components/RoleIcon";
import { LowBadge, pct, signed } from "../components/StatRows";
import { Chip, Skeleton } from "../components/ui";
import { useChampionPatches } from "../lib/api";
import { useUi } from "../lib/store";

const rateOf = (n: number, of: number) => (of > 0 ? n / of : 0);

/** Adjusted win rate per patch (oldest to newest) with its 95% Wilson range; hollow dots have fewer games than a change needs. */
function Trend({ points }: { points: PatchPoint[] }) {
  const reduce = useUi((s) => s.reduceMotion);
  const W = 560, H = 120, PAD = 28, data = [...points].reverse().filter((p) => p.games > 0).map((p) => ({ p, y: shrink(p.wins, p.games, 0.5, 50) * 100, w: wilson(p.wins, p.games).map((x) => x * 100) as [number, number] }));
  if (data.length < 2) return null;
  const ys = data.map((d) => d.y), lo = Math.min(50, ...ys) - 1, hi = Math.max(50, ...ys) + 1, span = Math.max(4, hi - lo), mid = (hi + lo) / 2;
  const top = mid + span / 2, y = (v: number) => 10 + ((top - Math.min(top, Math.max(top - span, v))) / span) * (H - 36);
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (data.length - 1), line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.y).toFixed(1)}`).join(" ");
  const label = `Adjusted win rate by patch: ${data.map((d) => `${d.p.patch} ${d.y.toFixed(1)}%`).join(", ")}`;
  return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label={label}>
    <line x1={PAD} x2={W - PAD} y1={y(50)} y2={y(50)} stroke="rgb(var(--line) / .15)" strokeDasharray="4 4" />
    <text x={W - PAD + 4} y={y(50) + 3} fontSize="10" fill="rgb(var(--muted))">50%</text>
    {data.map((d, i) => <line key={d.p.patch} x1={x(i)} x2={x(i)} y1={y(d.w[0])} y2={y(d.w[1])} stroke="rgb(var(--accent) / .35)" strokeWidth={3} strokeLinecap="round" />)}
    <motion.path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth={2} strokeLinejoin="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.9, ease: "easeOut" }} />
    {data.map((d, i) => <g key={d.p.patch}><circle cx={x(i)} cy={y(d.y)} r={4} fill={d.p.games >= MIN_DELTA_GAMES ? "rgb(var(--accent))" : "rgb(var(--base))"} stroke="rgb(var(--accent))" strokeWidth={2} />
      <text x={x(i)} y={H - 4} fontSize="10" textAnchor="middle" fill="rgb(var(--muted))">{d.p.patch}</text></g>)}
  </svg>);
}

/**
 * One champion across the kept patches (up to 5): win rate, pick rate and ban rate per patch, and the change from the patch before.
 * Win-rate changes are Bayesian-adjusted and coloured only when the 95% range excludes 0; both patches need 50 games, otherwise the change is withheld.
 */
export function PatchPanel({ id, roles }: { id: string; roles: Role[] }) {
  const [role, setRole] = useState<Role | undefined>(roles[0]), { data, isLoading, isError } = useChampionPatches(id, role);
  const rows = useMemo(() => (data?.patches ?? []).map((p, i, all) => { const older = all[i + 1]; return { p, d: older && older.matches > 0 && p.matches > 0 ? patchDelta(older, p) : null }; }), [data]);
  const withData = rows.filter((r) => r.p.games > 0).length;
  return (<section className="glass rounded-lg p-5 space-y-4" aria-label="Patch history">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-display text-lg font-semibold mr-auto">Patch history</h2>
      {roles.length > 1 && roles.map((r) => <Chip key={r} active={(data?.role ?? role) === r} onClick={() => setRole(r)}><span className="inline-flex items-center gap-1.5"><RoleIcon role={r} size={16} decorative />{r}</span></Chip>)}
    </div>
    {isLoading && <Skeleton className="h-40" />}
    {isError && <div className="text-sm text-muted">Patch history could not be loaded from the local backend.</div>}
    {data && withData === 0 && <div className="text-sm text-muted">No collected games for this champion in any kept patch with these filters.</div>}
    {data && withData > 0 && <>
      <Trend points={data.patches} />
      <table className="w-full text-sm">
        <caption className="sr-only">Win, pick and ban rate of {id} in {data.role ?? "its role"} by patch, newest first, with the change from the patch before</caption>
        <thead className="text-xs text-muted"><tr>
          <th className="text-left font-normal">Patch</th><th className="font-normal text-right">Games</th>
          <th className="font-normal text-right pl-2" title="Win rate adjusted for small samples">Win rate (adjusted)</th><th className="font-normal text-right pl-2" title="Change from the patch before. Coloured only when its 95% range excludes 0.">Change</th>
          <th className="font-normal text-right pl-2">Pick rate</th><th className="font-normal text-right pl-2">Change</th>
          <th className="font-normal text-right pl-2">Ban rate</th><th className="font-normal text-right pl-2">Change</th></tr></thead>
        <tbody>{rows.map(({ p, d }, i) => { const adj = p.games > 0 ? shrink(p.wins, p.games, 0.5, 50) : null; return (
          <tr key={p.patch} className="h-9 border-t border-line/5">
            <td className="whitespace-nowrap font-medium">{p.patch}{i === 0 && <span className="ml-2 rounded-full bg-accent/20 text-[10px] px-2 py-0.5">newest</span>}</td>
            <td className="text-right tabular-nums text-muted">{p.games.toLocaleString()}{p.games > 0 && <LowBadge games={p.games} />}</td>
            <td className={`text-right tabular-nums font-medium pl-2 ${adj === null ? "text-muted" : adj >= 0.5 ? "text-good" : "text-bad"}`} title={p.games ? `Raw ${pct(p.wins / p.games)}` : undefined}>{adj === null ? "–" : pct(adj)}</td>
            <td className="text-right pl-2">{d ? <Delta value={d.winDelta} tone={winTone(d)} title={d.winDelta === null ? `Needs at least ${MIN_DELTA_GAMES} games in both patches` : `95% range ${signed(d.winRange![0])} to ${signed(d.winRange![1])} pp${d.significant ? "" : ": could be luck"}`} /> : <span className="text-muted">–</span>}</td>
            <td className="text-right tabular-nums pl-2">{p.matches ? pct(rateOf(p.games, p.matches)) : "–"}</td>
            <td className="text-right pl-2">{d ? <Delta value={d.pickDelta} tone="plain" /> : <span className="text-muted">–</span>}</td>
            <td className="text-right tabular-nums pl-2">{p.matches ? pct(rateOf(p.bans, p.matches)) : "–"}</td>
            <td className="text-right pl-2">{d ? <Delta value={d.banDelta} tone="plain" /> : <span className="text-muted">–</span>}</td>
          </tr>); })}</tbody>
      </table>
      <p className="text-[11px] text-muted">Each row is compared with the patch below it. Win-rate changes need {MIN_DELTA_GAMES}+ games in both patches and are coloured only when the 95% range excludes 0; a patch also changes who plays the champion, so a change is not always caused by the balance changes. Pick and ban rates are shares of all collected games of that patch (bans count in every role). The patch filter does not apply here, region and rank do.</p>
    </>}
  </section>);
}

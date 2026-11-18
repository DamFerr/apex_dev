import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { relationStat } from "@apex/stats-core";
import type { RelationLine, Role } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { RoleIcon } from "../components/RoleIcon";
import { Tabs } from "../components/Tabs";
import { LowBadge, pct, WinRateCell } from "../components/StatRows";
import { Chip, Skeleton, spring } from "../components/ui";
import { useChampionRelations } from "../lib/api";

type Kind = "matchups" | "synergy";
type Sort = "best" | "worst" | "games";
const COLLAPSED = 12;
/** "+2.1 pp" / "−1.4 pp" (a real minus sign), so the sign never gets lost. */
const signed = (d: number) => { const a = Math.abs(d).toFixed(1); return `${Number(a) === 0 ? "" : d < 0 ? "\u2212" : "+"}${a} pp`; };
/** The bar is full at 10 points either way: more than that is outside what a sample this size can usually support. */
const BAR_FULL_PP = 10;

/**
 * Lane matchups and teammate synergies of one champion in one role. Every row shows its sample size, a win rate shrunk toward what the
 * two champions' overall win rates predict (so a tiny sample sits near "expected"), and the difference in percentage points.
 */
export function RelationsPanel({ id, roles }: { id: string; roles: Role[] }) {
  const [role, setRole] = useState<Role | undefined>(roles[0]), [kind, setKind] = useState<Kind>("matchups"), [sort, setSort] = useState<Sort>("best"), [all, setAll] = useState(false);
  const { data, isLoading, isError } = useChampionRelations(id, role);
  const rows = useMemo(() => {
    if (!data) return [];
    const k = kind === "matchups" ? "matchup" : "synergy", lines: RelationLine[] = kind === "matchups" ? data.matchups : data.synergies;
    const out = lines.map((l) => ({ l, s: relationStat(k, data.base, { games: l.baseGames, wins: l.baseWins }, { games: l.games, wins: l.wins }) }));
    return out.sort((a, b) => (sort === "games" ? b.l.games - a.l.games : sort === "worst" ? a.s.delta - b.s.delta : b.s.delta - a.s.delta) || a.l.champion.localeCompare(b.l.champion));
  }, [data, kind, sort]);
  const shown = all ? rows : rows.slice(0, COLLAPSED);

  return (<section className="glass rounded-lg p-5 space-y-4" aria-label="Matchups and synergy">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-display text-lg font-semibold mr-auto">Matchups and synergy</h2>
      {roles.length > 1 && roles.map((r) => <Chip key={r} active={role === r} onClick={() => { setRole(r); setAll(false); }}><span className="inline-flex items-center gap-1.5"><RoleIcon role={r} size={16} decorative />{r}</span></Chip>)}
    </div>
    <Tabs id="relations" value={kind} onChange={(k) => { setKind(k); setAll(false); }} tabs={[{ key: "matchups", label: "Matchups" }, { key: "synergy", label: "Synergy" }]} />
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="mr-auto truncate">{kind === "matchups" ? `Lane opponents in ${data?.role ?? "this role"}` : "Teammates in the other four roles"}</span>
      {(["best", "worst", "games"] as Sort[]).map((s) => <Chip key={s} active={sort === s} onClick={() => setSort(s)}>{s === "best" ? "Best first" : s === "worst" ? "Worst first" : "Most played"}</Chip>)}
    </div>
    <div role="tabpanel" aria-label={kind === "matchups" ? "Matchups" : "Synergy"}>
      {isLoading && <Skeleton className="h-48" />}
      {isError && <div className="text-sm text-muted" title="Matchups could not be loaded from the local backend.">Matchups unavailable<span className="sr-only">: could not be loaded from the local backend.</span></div>}
      {data && rows.length === 0 && (() => { const tip = `A pairing needs 5+ games${data.base.games === 0 ? ` (none as ${data.role ?? "this role"})` : ""}.`; return <div className="text-sm text-muted" title={tip}>Not enough games yet<span className="sr-only">: {tip}</span></div>; })()}
      {rows.length > 0 && <table className="w-full text-sm">
        <caption className="sr-only">{kind === "matchups" ? "Lane matchups" : "Teammate synergy"} sorted by {sort === "games" ? "games played" : "difference from expected"}</caption>
        <thead className="text-xs text-muted"><tr>
          <th className="text-left font-normal">Champion</th><th className="font-normal text-right">Games</th>
          <th className="font-normal text-right" title="Adjusted toward the expected rate, so small samples are not overstated. Hover a value for the raw rate, the expected rate and the 95% range.">Win rate</th>
          <th className="font-normal text-right pl-2" colSpan={2}>vs expected</th></tr></thead>
        <motion.tbody key={`${role}-${kind}-${sort}-${all}`} initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.02 } } }}>
          {shown.map(({ l, s }) => { const w = Math.min(100, (Math.abs(s.delta) / BAR_FULL_PP) * 100), good = s.delta >= 0.5, bad = s.delta <= -0.5; return (
            <motion.tr key={`${l.champion}-${l.role}`} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }} transition={spring} className="h-9 border-t border-line/5">
              <td className="whitespace-nowrap"><span className="inline-flex items-center gap-2 align-middle"><ChampIcon id={l.champion} name={l.name} size={26} /><span>{l.name}</span>
                {kind === "synergy" && <span className="inline-flex items-center gap-1 text-xs text-muted"><RoleIcon role={l.role} size={14} decorative />{l.role}</span>}</span><LowBadge games={l.games} /></td>
              <td className="text-right tabular-nums text-muted">{l.games.toLocaleString()}</td>
              <td className="text-right"><WinRateCell value={s.observed} raw={s.raw} lo={s.lo} hi={s.hi} note={`expected ${pct(s.expected)}`} /></td>
              <td className={`text-right tabular-nums font-medium pl-2 whitespace-nowrap ${good ? "text-good" : bad ? "text-bad" : "text-muted"}`}>{signed(s.delta)}</td>
              <td className="w-20 pl-2" aria-hidden><div className="relative h-1.5 rounded-full bg-line/10">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line/30" />
                <motion.span className={`absolute inset-y-0 rounded-full ${s.delta >= 0 ? "left-1/2 bg-good/70" : "right-1/2 bg-bad/70"}`} initial={{ width: 0 }} animate={{ width: `${w / 2}%` }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} /></div></td>
            </motion.tr>); })}
        </motion.tbody>
      </table>}
      {rows.length > 0 && <p className="pt-3 text-xs text-muted" title="Compares the win rate with what the two champions' overall win rates predict, in percentage points. Win rates are adjusted toward that expected value, so a small sample stays close to it.">vs expected: pp difference from what overall win rates predict</p>}
      {rows.length > COLLAPSED && <div className="pt-3"><Chip onClick={() => setAll((a) => !a)}>{all ? "Show fewer" : `Show all ${rows.length}`}</Chip></div>}
    </div>
  </section>);
}

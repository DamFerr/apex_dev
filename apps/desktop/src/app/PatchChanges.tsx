import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { MIN_DELTA_GAMES, patchDelta } from "@apex/stats-core";
import type { Role } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { Delta, winTone } from "../components/Delta";
import { LowBadge, pct, signed } from "../components/StatRows";
import { Chip, Skeleton, spring } from "../components/ui";
import { usePatchTrends } from "../lib/api";
import { Link } from "react-router-dom";
import { ExternalLink } from "../components/ExternalLink";
import { patchNotesUrl } from "../lib/patchNotes";

type Sort = "rising" | "falling" | "pick" | "ban";
const COLLAPSED = 15, SORTS: [Sort, string][] = [["rising", "Rising"], ["falling", "Falling"], ["pick", "Pick rate change"], ["ban", "Ban rate change"]];

/**
 * Tier list view: every champion of the role, newest patch against the one before. Win-rate changes are Bayesian-adjusted, coloured only when
 * their 95% range excludes 0, and withheld when either patch has fewer than 50 games of the champion in this role.
 */
export function PatchChanges({ role }: { role: Role }) {
  const { data, isLoading, isError, error } = usePatchTrends(role);
  const [sort, setSort] = useState<Sort>("rising"), [clearOnly, setClearOnly] = useState(false), [all, setAll] = useState(false);
  const { rows, hidden } = useMemo(() => {
    const out = (data?.rows ?? []).map((r) => ({ r, d: patchDelta(r.prev, r.cur) }));
    const ok = out.filter((x) => x.d.winDelta !== null);
    return { rows: ok, hidden: out.length - ok.length };
  }, [data]);
  const shown = useMemo(() => {
    const list = clearOnly ? rows.filter((x) => x.d.significant) : rows;
    const key = (x: (typeof rows)[number]) => (sort === "rising" ? -x.d.winDelta! : sort === "falling" ? x.d.winDelta! : sort === "pick" ? -Math.abs(x.d.pickDelta) : -Math.abs(x.d.banDelta));
    return [...list].sort((a, b) => key(a) - key(b) || a.r.id.localeCompare(b.r.id));
  }, [rows, sort, clearOnly]);
  const visible = all ? shown : shown.slice(0, COLLAPSED);
  const notes = { cur: patchNotesUrl(data?.patch), prev: patchNotesUrl(data?.previous) };

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  if (isError) return <div role="alert" className="glass rounded-lg p-8 text-sm text-bad text-center">{(error as Error).message}</div>;
  if (!data?.previous) return <div className="glass rounded-lg p-8 text-sm text-muted text-center">Patch changes need collected games from two patches{data?.patch ? `: only ${data.patch} has data so far` : ""}. They appear once the collector has seen the next patch.</div>;
  return (<section className="space-y-4" aria-label="Patch changes">
    <p className="text-sm text-muted">Patch <span className="text-text font-medium">{data.patch}</span> compared with <span className="text-text font-medium">{data.previous}</span>. Win-rate changes are adjusted for small samples and coloured only when
      their 95% range excludes 0; they need {MIN_DELTA_GAMES}+ games in both patches{hidden > 0 ? ` (${hidden} ${hidden === 1 ? "champion has" : "champions have"} fewer and ${hidden === 1 ? "is" : "are"} left out)` : ""}. A change can come from who plays the champion, not only from the balance changes. The patch filter does not apply here, region and rank do.</p>
    {(notes.cur || notes.prev) && <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Official patch notes">
      <span>Riot's official patch notes:</span>
      {notes.cur && <ExternalLink href={notes.cur}>Patch {data.patch}</ExternalLink>}
      {notes.prev && <ExternalLink href={notes.prev}>Patch {data.previous}</ExternalLink>}
    </p>}
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort patch changes">
      {SORTS.map(([k, label]) => <Chip key={k} active={sort === k} onClick={() => { setSort(k); setAll(false); }}>{label}</Chip>)}
      <span className="mx-1 h-4 w-px bg-line/10" aria-hidden />
      <Chip active={clearOnly} onClick={() => { setClearOnly(!clearOnly); setAll(false); }}>Clear changes only</Chip>
    </div>
    <div className="glass rounded-lg p-4">
      {shown.length === 0 ? <div className="p-6 text-sm text-muted text-center">{rows.length === 0 ? "No champion has enough games in both patches in this role yet." : "No change in this role is clearly more than luck yet."}</div> :
        <table className="w-full text-sm">
          <caption className="sr-only">Champions in {role}: win, pick and ban rate in patch {data.patch} and the change from {data.previous}</caption>
          <thead className="text-xs text-muted"><tr>
            <th className="text-left font-normal">Champion</th><th className="font-normal text-right">Games</th>
            <th className="font-normal text-right pl-2">Win rate (adjusted)</th><th className="font-normal text-right pl-2">Change</th>
            <th className="font-normal text-right pl-2">Pick rate</th><th className="font-normal text-right pl-2">Change</th>
            <th className="font-normal text-right pl-2">Ban rate</th><th className="font-normal text-right pl-2">Change</th></tr></thead>
          <motion.tbody key={`${role}-${sort}-${clearOnly}-${all}`} initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.02 } } }}>
            {visible.map(({ r, d }) => (
              <motion.tr key={r.id} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }} transition={spring} className="h-10 border-t border-line/5">
                <td className="whitespace-nowrap"><Link to={`/champions/${r.id}`} className="focus-ring inline-flex items-center gap-2 rounded-md hover:text-accent"><ChampIcon id={r.id} name={r.name} size={26} /><span>{r.name}</span></Link><LowBadge games={r.cur.games} /></td>
                <td className="text-right tabular-nums text-muted" title={`${r.prev.games.toLocaleString()} games in ${data.previous}`}>{r.cur.games.toLocaleString()}</td>
                <td className="text-right tabular-nums pl-2" title={`${pct(d.prevWinRate)} in ${data.previous}`}>{pct(d.winRate)}</td>
                <td className="text-right pl-2"><Delta value={d.winDelta} tone={winTone(d)} title={`95% range ${signed(d.winRange![0])} to ${signed(d.winRange![1])} pp${d.significant ? "" : ": could be luck"}`} /></td>
                <td className="text-right tabular-nums pl-2">{pct(d.pickRate)}</td><td className="text-right pl-2"><Delta value={d.pickDelta} tone="plain" /></td>
                <td className="text-right tabular-nums pl-2">{pct(d.banRate)}</td><td className="text-right pl-2"><Delta value={d.banDelta} tone="plain" /></td>
              </motion.tr>))}
          </motion.tbody>
        </table>}
      {shown.length > COLLAPSED && <div className="pt-3 text-center"><Chip onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${shown.length}`}</Chip></div>}
    </div>
  </section>);
}

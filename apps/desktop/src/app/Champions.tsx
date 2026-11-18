import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Role } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { LowBadge, pct, rate, wrClass } from "../components/StatRows";
import { FilterBar } from "../components/FilterBar";
import { Chip, Skeleton } from "../components/ui";
import { useChampions } from "../lib/api";

const roleName = (r: string) => (r === "ADC" ? "ADC" : r[0] + r.slice(1).toLowerCase());
const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
type SortKey = "name" | "win" | "pick" | "ban" | "games";

export function Champions() {
  const [role, setRole] = useState<Role | undefined>();
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "win", dir: -1 });
  const { data, isError, error } = useChampions(role), nav = useNavigate();
  const rows = useMemo(() => {
    if (!data) return [];
    const v = (c: (typeof data.champions)[number]) => ({ name: c.name, win: rate(c.wins, c.games).adj, pick: c.games / data.totalGames, ban: c.bans / data.totalGames, games: c.games })[sort.k];
    return [...data.champions]   // a copy: sorting must not reorder the cached query data
      .sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [data, sort]);
  const th = (k: SortKey, label: string, left = false) => (
    <th className={`font-normal ${left ? "text-left" : "text-right"}`} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="focus-ring hover:text-text" onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : -1 })}>{label}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</button></th>);
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Champions</h1>
    <p className="text-sm text-muted mt-1 mb-5">{data
      ? `Collected data: ${data.totalGames.toLocaleString()} games, ${data.patch === "all" ? "last 5 patches" : `patch ${data.patch}`}. ${data.totalGames < 500 ? "Small sample, so expect noisy numbers. " : ""}Win rates are Bayesian-adjusted; hover one for the raw value.`
      : "Statistics from the games Apex has collected. Win rates are Bayesian-adjusted; hover one for the raw value."}</p>
    <FilterBar />
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Chip active={!role} onClick={() => setRole(undefined)}>All</Chip>
      {ROLES.map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}>{roleName(r)}</Chip>)}
    </div>
    <div className="glass rounded-lg p-2">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted"><tr className="h-9">{th("name", "Champion", true)}<th className="text-left font-normal">Roles</th>{th("win", "Win rate")}{th("pick", "Pick")}{th("ban", "Ban")}{th("games", "Games")}</tr></thead>
        <motion.tbody key={`${role}-${!!data}`} initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.02 } } }}>
          {!data && !isError && Array.from({ length: 8 }, (_, i) => <tr key={i}><td colSpan={6} className="py-1"><Skeleton className="h-9" /></td></tr>)}
          {rows.map((c) => { const s = rate(c.wins, c.games); return (
            <motion.tr key={c.id} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }} onClick={() => nav(`/champions/${c.id}`)}
              className="h-12 border-t border-line/5 cursor-pointer hover:bg-line/5">
              <td><Link to={`/champions/${c.id}`} className="focus-ring flex items-center gap-3 rounded-md" onClick={(e) => e.stopPropagation()}><ChampIcon id={c.id} name={c.name} />{c.name}</Link></td>
              <td className="text-xs text-muted">{c.roles.map(roleName).join(", ")}</td>
              <td className={`text-right tabular-nums font-medium ${wrClass(s.adj)}`} title={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`}>{pct(s.adj)}<LowBadge games={c.games} /></td>
              <td className="text-right tabular-nums">{pct(c.games / data!.totalGames)}</td>
              <td className="text-right tabular-nums">{pct(c.bans / data!.totalGames)}</td>
              <td className="text-right tabular-nums text-muted pr-2">{c.games.toLocaleString()}</td>
            </motion.tr>); })}
        </motion.tbody>
      </table>
      {isError && <div role="alert" className="p-8 text-sm text-bad text-center">{(error as Error).message}</div>}
      {data && data.champions.length === 0 && <div className="p-8 text-sm text-muted text-center">No collected games match these filters yet. The collector gathers every region and rank in the background, so try “All regions” or a lower rank, or check back soon.</div>}
    </div>
  </>);
}

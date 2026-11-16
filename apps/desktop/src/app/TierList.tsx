import { buildTierList, GRADE_CUTS, minListedGames, type Grade } from "@apex/stats-core";
import { RoleIcon } from "../components/RoleIcon";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Role } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { FilterBar } from "../components/FilterBar";
import { pct } from "../components/StatRows";
import { Chip, Skeleton, spring } from "../components/ui";
import { useChampions } from "../lib/api";

const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const roleName = (r: string) => (r === "ADC" ? "ADC" : r[0] + r.slice(1).toLowerCase());
const GRADE_STYLE: Record<Grade, string> = {
  "S+": "bg-gold/20 text-gold border-gold/40", S: "bg-accent/20 text-text border-accent/50", A: "bg-good/15 text-good border-good/30",
  B: "bg-raised text-text border-line/10", C: "bg-raised text-muted border-line/10", D: "bg-bad/15 text-bad border-bad/30",
};

export function TierList() {
  const [role, setRole] = useState<Role>("MID");
  const { data, isError, error } = useChampions(role);
  const rows = useMemo(() => {
    if (!data) return [];
    const names = new Map(data.champions.map((c) => [c.id, c.name]));
    return buildTierList(data.champions.map((c) => ({ id: c.id, games: c.games, wins: c.wins, bans: c.bans })), data.totalGames)
      .map((r) => ({ ...r, name: names.get(r.id) ?? r.id }));
  }, [data]);
  const bands = GRADE_CUTS.map(([g]) => g) as Grade[];
  const hidden = data ? data.champions.length - rows.length : 0, bar = data ? minListedGames(data.champions.reduce((s, c) => s + c.games, 0)) : 0;
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Tier List</h1>
    <p className="text-sm text-muted mt-1 mb-5">
      Grades compare champions within one role: win-rate edge (Bayesian-adjusted) plus a small bonus for pick and ban rate.
      Champions with too little data in this role (under {bar.toLocaleString()} games) are hidden, because their numbers are often wrong.
      {hidden > 0 && ` ${hidden} hidden.`}
    </p>
    <FilterBar />
    <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Role">
      {ROLES.map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}><span className="inline-flex items-center gap-1.5"><RoleIcon role={r} size={16} decorative />{roleName(r)}</span></Chip>)}
    </div>
    <div className="glass rounded-lg p-2 divide-y divide-line/5">
      {isError && <div role="alert" className="p-8 text-sm text-bad text-center">{(error as Error).message}</div>}
      {!data && !isError && Array.from({ length: 4 }, (_, i) => <div key={i} className="p-2"><Skeleton className="h-14" /></div>)}
      {data && rows.length === 0 && <div className="p-8 text-sm text-muted text-center">Not enough collected games for this role and these filters yet. Try “All regions” or a lower rank, or check back once the collector has more games.</div>}
      {data && bands.map((g) => {
        const band = rows.filter((r) => r.grade === g);
        if (band.length === 0) return null;
        return (
          <section key={g} aria-label={`Tier ${g}`} className="flex items-start gap-4 p-3">
            <div className={`w-14 shrink-0 h-14 rounded-md border grid place-items-center font-display text-xl font-semibold ${GRADE_STYLE[g]}`}>{g}</div>
            <motion.ul key={`${role}-${g}`} initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.025 } } }} className="flex flex-wrap gap-2 min-w-0">
              {band.map((r) => (
                <motion.li key={r.id} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} transition={spring}>
                  <Link to={`/champions/${r.id}`} className="focus-ring flex items-center gap-2 rounded-md bg-raised/60 border border-line/10 pl-1 pr-3 py-1 hover:bg-raised"
                    title={`${r.games.toLocaleString()} games · pick ${pct(r.pickRate)} · ban ${pct(r.banRate)} · edge ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)} pp`}>
                    <ChampIcon id={r.id} name={r.name} size={32} />
                    <span className="text-sm leading-tight">{r.name}<span className={`block text-xs tabular-nums ${r.winRate >= 0.5 ? "text-good" : "text-bad"}`}>{pct(r.winRate)}</span></span>
                  </Link>
                </motion.li>))}
            </motion.ul>
          </section>);
      })}
    </div>
  </>);
}

import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ChampIcon } from "../components/ChampIcon";
import { FilterBar } from "../components/FilterBar";
import { StatRows, pct, rate } from "../components/StatRows";
import { Skeleton, StatCard } from "../components/ui";
import { BuildPanel } from "./BuildPanel";
import { useChampion } from "../lib/api";
import { splashUrl } from "../lib/ddragon";

export function ChampionPage() {
  const { id = "" } = useParams(), { data: c, isError, error } = useChampion(id);
  if (isError) return (
    <div className="space-y-4"><Link to="/champions" className="focus-ring inline-flex items-center gap-1 text-sm text-muted hover:text-text rounded-md"><ArrowLeft size={14} /> Champions</Link>
      <FilterBar /><div className="glass rounded-lg p-8 text-sm text-bad">{(error as Error).message}. Try different filters, or <Link className="underline" to="/champions">go back to champions</Link>.</div></div>);
  if (!c) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  const s = rate(c.wins, c.games);
  const matchups = [...c.matchups].sort((a, b) => rate(b.wins, b.games).adj - rate(a.wins, a.games).adj);
  return (<div className="space-y-6">
    <Link to="/champions" className="focus-ring inline-flex items-center gap-1 text-sm text-muted hover:text-text rounded-md"><ArrowLeft size={14} /> Champions</Link>
    <FilterBar />
    <div className="relative h-40 rounded-xl overflow-hidden border border-line/10 bg-gradient-to-br from-accent/30 to-surface">
      <div className="absolute inset-0 bg-cover bg-[center_20%] opacity-50" style={{ backgroundImage: `url(${splashUrl(c.id)})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />
      <div className="absolute bottom-4 left-5 flex items-center gap-4">
        <ChampIcon id={c.id} name={c.name} size={64} />
        <div><h1 className="font-display text-3xl font-semibold">{c.name}</h1>
          <div className="text-xs text-muted">{c.roles.join(" / ")} · {c.tags.join(", ")}</div></div>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Win rate (adjusted)" value={s.adj * 100} suffix="%" hint={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`} />
      <StatCard label="Pick rate" value={(c.games / c.totalGames) * 100} suffix="%" />
      <StatCard label="Ban rate" value={(c.bans / c.totalGames) * 100} suffix="%" />
      <StatCard label="Games" value={c.games} decimals={0} hint={s.badge === "low" ? "Low data: treat with caution" : `${s.badge} sample`} />
    </div>
    {c.skillOrder.length > 0 && <div className="glass rounded-lg p-5"><div className="text-sm font-medium mb-2">Skill order (max priority)</div>
      <div className="flex items-center gap-2">{c.skillOrder.map((k, i) => <span key={k} className="flex items-center gap-2">
        {i > 0 && <span className="text-muted">›</span>}<span className="size-9 grid place-items-center rounded-md bg-accent/20 border border-accent/40 font-display font-semibold">{k}</span></span>)}</div></div>}
    <BuildPanel id={c.id} roles={c.roles} />
    <div className="grid grid-cols-2 gap-4">
      <div className="glass rounded-lg p-5"><StatRows title="Items" rows={c.builds} /></div>
      <div className="glass rounded-lg p-5"><StatRows title="Keystone runes" rows={c.runes} /></div>
    </div>
    <div className="glass rounded-lg p-5"><StatRows title="Matchups (best to worst)" rows={matchups} /></div>
  </div>);
}

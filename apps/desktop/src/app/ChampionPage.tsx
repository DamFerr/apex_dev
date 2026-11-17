import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ChampIcon } from "../components/ChampIcon";
import { FilterBar } from "../components/FilterBar";
import { StatRows, pct, rate } from "../components/StatRows";
import { Skeleton, StatCard } from "../components/ui";
import { GameIcon } from "../components/GameIcon";
import { RoleIcon } from "../components/RoleIcon";
import { BuildPanel } from "./BuildPanel";
import { RelationsPanel } from "./RelationsPanel";
import { PatchPanel } from "./PatchPanel";
import { useChampion } from "../lib/api";
import { splashUrl } from "../lib/ddragon";

export function ChampionPage() {
  const { id = "" } = useParams(), { data: c, isError, error } = useChampion(id);
  if (isError) return (
    <div className="space-y-4"><Link to="/champions" className="focus-ring inline-flex items-center gap-1 text-sm text-muted hover:text-text rounded-md"><ArrowLeft size={14} /> Champions</Link>
      <FilterBar /><div className="glass rounded-lg p-8 text-sm text-bad">{(error as Error).message}. Try different filters, or <Link className="underline" to="/champions">go back to champions</Link>.</div></div>);
  if (!c) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  const s = rate(c.wins, c.games);
  return (<div className="space-y-6">
    <Link to="/champions" className="focus-ring inline-flex items-center gap-1 text-sm text-muted hover:text-text rounded-md"><ArrowLeft size={14} /> Champions</Link>
    <FilterBar />
    <div className="relative h-40 rounded-xl overflow-hidden border border-line/10 bg-gradient-to-br from-accent/30 to-surface">
      <div className="absolute inset-0 bg-cover bg-[center_20%] opacity-50" style={{ backgroundImage: `url(${splashUrl(c.id)})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />
      <div className="absolute bottom-4 left-5 flex items-center gap-4">
        <ChampIcon id={c.id} name={c.name} size={64} />
        <div><h1 className="font-display text-3xl font-semibold">{c.name}</h1>
          <div className="text-xs text-muted flex items-center gap-2">{c.roles.map((r) => <span key={r} className="inline-flex items-center gap-1"><RoleIcon role={r} size={14} decorative />{r}</span>)}<span>· {c.tags.join(", ")}</span></div></div>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="Win rate (adjusted)" value={s.adj * 100} suffix="%" hint={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`} />
      <StatCard label="Pick rate" value={(c.games / c.totalGames) * 100} suffix="%" />
      <StatCard label="Ban rate" value={(c.bans / c.totalGames) * 100} suffix="%" />
      <StatCard label="Games" value={c.games} decimals={0} hint={s.badge === "low" ? "Low data: treat with caution" : `${s.badge} sample`} />
    </div>
    <BuildPanel id={c.id} roles={c.roles} />
    <div className="grid grid-cols-2 gap-4">
      <div className="glass rounded-lg p-5"><StatRows title="Items" rows={c.builds} icon={(r) => typeof r.id === "number" ? <GameIcon kind="item" id={r.id} name={r.name} size={26} /> : null} />
        {c.builds.some((r) => r.wpa) && <p className="text-[11px] text-muted mt-3">WPA = win probability added, in percentage points: how much owning the item goes with winning, compared with games without it of the same length and the same number of finished items. Final inventories only, so it shows a link, not proof.</p>}</div>
      <div className="glass rounded-lg p-5"><StatRows title="Keystone runes" rows={c.runes} icon={(r) => typeof r.id === "number" ? <GameIcon kind="rune" id={r.id} size={26} /> : null} /></div>
    </div>
    <PatchPanel id={c.id} roles={c.roles} />
    <RelationsPanel id={c.id} roles={c.roles} />
  </div>);
}

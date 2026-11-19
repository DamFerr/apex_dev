import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import type { Role } from "@apex/schema";
import { sortVariants, spellPairsOf, DEFAULT_VARIANT_SORT } from "@apex/lcu-core";
import { ChampIcon } from "../components/ChampIcon";
import { GameIcon } from "../components/GameIcon";
import { LowBadge } from "../components/StatRows";
import { Button, Skeleton } from "../components/ui";
import { useChampionBuild } from "../lib/api";
import { champIndex } from "../lib/ddragon";
import { MIN_BUILD_GAMES } from "../lib/importer";
import { runImport, useDraft } from "../lib/lcu";
import { resolveSetup, type PickSetup } from "../lib/pickSetup";
import { displaySpells } from "../lib/spells";
import { isTauri } from "../lib/tauri";
import { RuneIcons, Wr } from "./DraftBuild";

const ROLES: readonly string[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
/** The route carries the Data Dragon id ("Ahri"); the import needs the numeric champion key. */
const keyOf = (id: string) => { for (const c of champIndex.values()) if (c.id === id) return c.key; return undefined; };

/** One selectable row (build type, rune page or spell pair): same look as the champion page's build list. */
const Option = ({ selected, label, onClick, children }: { selected: boolean; label: string; onClick: () => void; children: React.ReactNode }) =>
  <button onClick={onClick} aria-pressed={selected} aria-label={label}
    className={`focus-ring w-full text-left rounded-lg border px-3.5 py-2.5 transition-colors flex items-center gap-2 ${selected ? "border-accent/60 bg-accent/15" : "border-line/10 hover:bg-raised/60"}`}>{children}</button>;

/**
 * Setup page for the champion you locked: pick the build type, rune page and summoner spells, then "Import".
 * Same data as the champion page (`useChampionBuild`) and the same rules as the import (`resolveSetup`), so the highlighted rows are
 * exactly what Import writes. Nothing is chosen for you beyond the defaults (best build type, top page / pair with enough games).
 */
export function PickSetupPage() {
  const { id = "", role: roleParam } = useParams(), role = roleParam && ROLES.includes(roleParam) ? (roleParam as Role) : undefined;
  const [sel, setSel] = useState<PickSetup>({}), connected = useDraft((s) => s.draft.connected);
  const { data: b, isLoading, isError } = useChampionBuild(id, role), key = keyOf(id), name = champIndex.get(key ?? -1)?.name ?? id;
  const r = resolveSetup(b ?? null, sel, MIN_BUILD_GAMES), core = r.core, pairs = core ? spellPairsOf(core) : [];
  const variants = b ? sortVariants(b, DEFAULT_VARIANT_SORT) : [];
  const disabled = !isTauri || !connected || key === undefined;

  return (<div className="space-y-4">
    <Link to="/draft" className="focus-ring inline-flex items-center gap-1 text-sm text-muted hover:text-text rounded-md"><ArrowLeft size={14} /> Draft</Link>
    <div className="glass rounded-lg p-5 space-y-5" aria-label="Pick setup">
      <div className="flex flex-wrap items-center gap-3">
        <ChampIcon id={id} name={name} size={40} />
        <h1 className="font-display text-xl font-semibold mr-auto">{name}{role ? ` · ${role}` : ""}</h1>
        {isTauri && <Button disabled={disabled} title={!connected ? "Connect to the League client first" : 'Writes the chosen rune page and summoner spells, plus the item set(s), named "Apex: <champion>"'}
          onClick={() => key !== undefined && void runImport(key, role ?? null, sel)}><Download size={14} aria-hidden />Import</Button>}
      </div>
      {isLoading && <Skeleton className="h-40" />}
      {isError && <div className="text-sm text-muted">The build could not be loaded from the local backend.</div>}
      {b && !core?.runePages.length && !pairs.length && <div className="text-sm text-muted" title="Build data is stored for newly collected games only.">No build data for these filters yet. Import writes Apex defaults.</div>}
      {b && core && <div className="grid gap-x-8 gap-y-6 items-start grid-cols-1 min-[1100px]:grid-cols-[230px_minmax(0,1fr)_minmax(0,1fr)]">
        {variants.length > 0 && <section className="space-y-2" aria-label="Build type">
          <h2 className="text-xs uppercase tracking-wide text-muted">Build type</h2>
          {variants.map((v) => <Option key={v.id} selected={v.id === r.variantId} label={`${v.label} build, ${v.games} games`} onClick={() => setSel({ variantId: v.id })}>
            <span className="font-display font-semibold mr-auto">{v.label}</span><Wr wins={v.wins} games={v.games} /></Option>)}
        </section>}
        <section className="space-y-2" aria-label="Rune page">
          <h2 className="text-xs uppercase tracking-wide text-muted">Rune page</h2>
          {core.runePages.slice(0, 5).map((p, i) => <Option key={i} selected={r.rune === p} label={`Rune page ${i + 1}, ${p.games} games`} onClick={() => setSel((s) => ({ ...s, runePage: i }))}>
            <span className="flex items-center gap-1 flex-wrap mr-auto"><RuneIcons rune={p} /></span><Wr wins={p.wins} games={p.games} /></Option>)}
          {core.runePages.length === 0 && <p className="text-xs text-muted">No rune data: class defaults are written.</p>}
        </section>
        <section className="space-y-2" aria-label="Summoner spells">
          <h2 className="text-xs uppercase tracking-wide text-muted">Summoner spells</h2>
          {pairs.slice(0, 5).map((p, i) => <Option key={i} selected={r.spell === p} label={`Spell pair ${i + 1}, ${p.games} games`} onClick={() => setSel((s) => ({ ...s, spellPair: i }))}>
            <span className="flex items-center gap-1 mr-auto">{displaySpells(p.ids).map((s) => <GameIcon key={s} kind="spell" id={s} size={28} />)}</span><Wr wins={p.wins} games={p.games} /></Option>)}
          {pairs.length === 0 && <p className="text-xs text-muted">No spell data: role defaults are written.</p>}
        </section>
      </div>}
      {b && core && <p className="text-xs text-muted" title="Win rates are adjusted for small samples; the tooltip on each rate shows the raw rate and the 95% range. A pair or page you pick yourself is written even with few games.">
        {core.games.toLocaleString()} games{role ? ` · as ${role}` : ""}<LowBadge games={core.games} /> · item sets are written for every build type</p>}
    </div>
  </div>);
}

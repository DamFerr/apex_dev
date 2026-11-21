import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Download } from "lucide-react";
import type { Role } from "@apex/schema";
import { spellPairsOf } from "@apex/lcu-core";
import { ChampLink, ChampIconLink } from "../components/ChampLink";
import { Button } from "../components/ui";
import { useChampionBuild } from "../lib/api";
import { champIndex } from "../lib/ddragon";
import { MIN_BUILD_GAMES } from "../lib/importer";
import { runImport, useDraft } from "../lib/lcu";
import type { ImportStep } from "../lib/importSummary";
import { changedSteps, resolveSetup, type PickSetup } from "../lib/pickSetup";
import { isTauri } from "../lib/tauri";
import { BuildPanel } from "./BuildPanel";
import { DraftContext } from "./DraftContext";

const ROLES: readonly string[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
/** The route carries the Data Dragon id ("Ahri"); the import needs the numeric champion key. */
const keyOf = (id: string) => { for (const c of champIndex.values()) if (c.id === id) return c.key; return undefined; };
const indexOrNull = <T,>(list: readonly T[], item: T | null): number | null => { const i = item ? list.indexOf(item) : -1; return i < 0 ? null : i; };

/**
 * Setup page for the champion you locked: the same build view as the champion page (`BuildPanel`: build types, full rune pages, spells, items, skill order),
 * where the build type, rune page and summoner spells are YOUR choice. What is lit is exactly what Import writes (`resolveSetup`).
 * Every click writes it to the League client during champ select at once (only what you changed), so you never need the button; it stays as "Import again".
 * Only your own rune page, spells and item set are written, and only after your own click (docs/COMPLIANCE.md row 3).
 */
export function PickSetupPage() {
  const { id = "", role: roleParam } = useParams(), role = roleParam && ROLES.includes(roleParam) ? (roleParam as Role) : undefined;
  const [sel, setSel] = useState<PickSetup>({});
  const connected = useDraft((s) => s.draft.connected), active = useDraft((s) => s.draft.active), imported = useDraft((s) => s.imported);
  const { data: b } = useChampionBuild(id, role), key = keyOf(id), name = champIndex.get(key ?? -1)?.name ?? id;
  const r = resolveSetup(b ?? null, sel, MIN_BUILD_GAMES), core = r.core;
  const done = key !== undefined && imported === key, canWrite = isTauri && connected && key !== undefined;

  // A click writes at once, and only what it changed. While a write runs, further clicks are merged into ONE follow-up write with the latest choice (so a fast
  // series of clicks never queues up). The item sets do not depend on your choice: they are written with the first import of this champion only.
  const busy = useRef(false), itemsSent = useRef(false), queued = useRef<{ sel: PickSetup; only: Set<ImportStep> } | null>(null);
  const write = async (next: PickSetup, only: Set<ImportStep>) => {
    if (busy.current) { const q = queued.current; queued.current = { sel: next, only: new Set([...(q?.only ?? []), ...only]) }; return; }
    busy.current = true;
    try { await runImport(key!, role ?? null, next, { build: b, only: [...only], quiet: true }); }
    finally { busy.current = false; const q = queued.current; queued.current = null; if (q) void write(q.sel, q.only); }
  };
  const choose = (next: PickSetup) => {
    const steps = changedSteps(sel, next);
    setSel(next);
    if (!canWrite || !active || !steps.length) return;   // only after a click of yours, and only while champ select runs
    if (!done && !itemsSent.current) { steps.push("items"); itemsSent.current = true; }
    void write(next, new Set(steps));
  };

  return (<div className="space-y-4">
    <Link to="/draft" className="focus-ring inline-flex items-center gap-1 text-sm text-muted hover:text-text rounded-md"><ArrowLeft size={14} /> Draft</Link>
    <div className="glass rounded-lg p-5 flex flex-wrap items-center gap-3" aria-label="Pick setup">
      <ChampIconLink id={id} name={name} size={40} />
      <h1 className="font-display text-xl font-semibold mr-auto"><ChampLink id={id} name={name} />{role ? ` · ${role}` : ""}</h1>
      {done && <span role="status" aria-label="Imported" title="Written to the League client. Every change you make here is written again by itself." className="inline-flex items-center gap-1 text-sm font-medium text-good"><Check size={14} aria-hidden />Imported</span>}
      {isTauri && <Button disabled={!canWrite} title={!connected ? "Connect to the League client first" : 'Writes the chosen rune page and summoner spells, plus the item set(s), named "Apex: <champion>". Changes are also written by themselves during champ select.'}
        onClick={() => key !== undefined && void runImport(key, role ?? null, sel)}><Download size={14} aria-hidden />{done ? "Import again" : "Import"}</Button>}
    </div>
    {/* Build chooser = main column; the read-only draft context (teams, bans, win probability, composition) beside it on wide windows, below on narrow ones (I.7). */}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem] items-start">
    <BuildPanel id={id} roles={role ? [role] : []} pick={{ sel, variantId: r.variantId, runeIndex: core ? indexOrNull(core.runePages, r.rune) : null, spellIndex: core ? indexOrNull(spellPairsOf(core), r.spell) : null, onChange: choose }} />
    <DraftContext />
    </div>
    <p className="text-xs text-muted px-1" title="Item sets are written for every build type, so you can switch in game from the shop. A rune page or spell pair you pick yourself is written even with few games.">Item sets are written for every build type · {isTauri ? "each change is imported by itself during champ select" : "importing needs the desktop app"}</p>
  </div>);
}

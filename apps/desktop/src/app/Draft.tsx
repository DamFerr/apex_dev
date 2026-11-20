import { type Slot } from "@apex/lcu-core";
import { Button } from "../components/ui";
import { applyCompact } from "../lib/compact";
import { isTauri } from "../lib/tauri";
import { actInChampSelect } from "../lib/champSelectActions";
import { takenChampions } from "@apex/lcu-core";
import { useUi } from "../lib/store";
import { useEffect, useMemo, useState } from "react";
import { isInGame } from "@apex/lcu-core";
import { Tabs } from "../components/Tabs";
import { RiotIdPrompt } from "../components/RiotIdPrompt";
import { LiveGameView } from "./LiveGameView";
import { familiarity, poolForRole, poolNote, poolZ, recommend, recommendBans, type PoolChampion } from "@apex/draft-engine";
import { FilterBar } from "../components/FilterBar";
import { usePool } from "../lib/api";
import { BanSuggestions, Recommendations } from "./DraftPanels";
import { DraftBoard, DraftInsights, useDraftData, useLockedPicks } from "./DraftContext";
import { champId, runImport, useDraft } from "../lib/lcu";
import { useNavigate } from "react-router-dom";
import { Download, Hammer, Maximize2, Minimize2, Swords, Timer, Unplug } from "lucide-react";

/** A small pill toggle (checkbox inside, so it stays a real, labelled checkbox for keyboard and screen readers). The explanation is the tooltip. */
function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return <label title={hint} className={`h-8 px-3 rounded-full border border-line/10 inline-flex items-center gap-2 text-xs focus-within:ring-2 focus-within:ring-accent/60 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-raised/40"}`}>
    <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-[rgb(var(--accent))]" />{label}</label>;
}

export function Draft() {
  const d = useDraftData(), { champsQ, champs, stats, data, source } = d, myId = useUi((s) => s.myRiotId);
  const poolSource = "your mastery and recent games";
  const { draft, autoImport, setAutoImport, spells, setSpells, items, setItems, clickActions, setClickActions } = useDraft();
  const compact = useUi((s) => s.compact);
  const canClick = isTauri && clickActions && draft.connected;
  // Champ select first, then the live game of the same match. The tab follows the League client's phase; you can still click the other one.
  const gameOn = draft.gameflow === "GameStart" || isInGame(draft.gameflow);
  const [tab, setTab] = useState<"draft" | "live">(gameOn ? "live" : "draft");
  useEffect(() => { if (draft.gameflow === "ChampSelect") setTab("draft"); else if (gameOn) setTab("live"); }, [draft.gameflow, gameOn]);
  const me = draft.slots.find((x) => x.isLocal), myKey = me ? (me.locked ? me.championId : me.hoverId) : 0; // Import writes your real pick
  const nav = useNavigate(), lockedKey = me?.locked ? champId(me.championId) : undefined;
  const [personalizeOn, setPersonalize] = useState(true), poolQ = usePool(myId);
  // The pool overlay needs your Riot ID and a loaded pool; say so on the toggle instead of silently doing nothing.
  const poolMissing = !myId ? "Add your Riot ID in Settings to use your champion pool." : poolQ.isError ? "Your champion pool could not be loaded (backend or Riot unreachable)." : poolQ.isLoading ? "Loading your champion pool…" : null;
  const personalize = personalizeOn && poolMissing === null;
  // Your pool (mastery plus recent games per role), keyed by numeric champion key ...
  const poolAll = useMemo<PoolChampion[] | null>(() => {
    if (!poolQ.data || !champs) return null;
    const key = new Map(champs.map((c) => [c.id, c.key]));
    return poolQ.data.filter((p) => key.has(p.champion)).map((p) => ({ champion: key.get(p.champion)!, points: p.points,
      byRole: Object.fromEntries((p.byRole ?? []).map((r) => [r.role, { games: r.games, wins: r.wins }])) }));
  }, [poolQ.data, champs]);
  // ... cut down to the role you are playing now: a champion you only play in another role (your top-lane Irelia in a jungle game) is not part of it.
  const pool = useMemo(() => (data && poolAll && me?.role ? new Map(poolForRole(poolAll, me.role, data.roles).map((p) => [p.champion, p] as const)) : null), [data, poolAll, me?.role]);
  const picks = useLockedPicks(draft.slots);
  const recs = useMemo(() => {
    if (!data || !champs || !draft.active || !me?.role || me.locked) return [];
    const t0 = performance.now();
    const exclude = takenChampions(draft);
    const r = recommend(picks.ally, picks.enemy, me.role, champs.map((c) => c.key), data, {
      exclude, limit: 6,
      personal: (c) => { const p = personalize ? pool?.get(c) : null; return p && (p.points > 0 || p.games > 0) ? { z: poolZ(data.strength(c), p), note: `You: ${poolNote(p)}` } : null; },
    });
    if (import.meta.env.DEV) console.info(`[perf] draft eval ${(performance.now() - t0).toFixed(1)} ms (budget 150)`);
    return r;
  }, [data, champs, draft.active, draft.slots, draft.bans, picks, me, pool, personalize]);
  const banSuggestions = useMemo(() => {
    if (!data || !champs || !draft.banning || !me?.role) return [];
    const exclude = takenChampions(draft);
    return recommendBans(me.role, champs.map((c) => c.key), data, personalize && pool ? [...pool.values()].map((p) => ({ champion: p.champion, games: p.games, weight: familiarity(p.points, p.games) })).filter((p) => p.weight > 0) : [], { exclude, limit: 5 });
  }, [data, champs, draft.banning, draft.slots, draft.bans, me, pool, personalize]);
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight mb-5">Draft</h1>
    {!draft.connected && <div role="status" className="glass rounded-lg px-4 py-3 mb-5 text-sm text-muted flex items-center gap-3"><Unplug size={16} aria-hidden />League client not detected. Start it and Apex connects automatically.</div>}
    <div className="mb-5"><Tabs id="draft" value={tab} onChange={setTab} tabs={[{ key: "draft", label: "Champ select" }, { key: "live", label: "Live game" }]} /></div>
    {tab === "live" ? (myId ? <LiveGameView id={myId} watch={gameOn} refresh /> : <RiotIdPrompt />) : <>
    <FilterBar />
    <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Draft options">
      {draft.active && lockedKey && <Button variant="ghost" title="Back to the build and rune setup of your locked champion" onClick={() => nav(`/draft/setup/${encodeURIComponent(lockedKey)}${me?.role ? `/${me.role}` : ""}`)}><Hammer size={14} aria-hidden />Open setup</Button>}
      {isTauri && <Button variant="ghost" disabled={!draft.connected || !myKey} title={'Writes the rune page, summoner spells and item set(s) the champion page shows (its best build), named "Apex: <champion>"'} onClick={() => void runImport(myKey, me?.role ?? null)}><Download size={14} aria-hidden />Import now</Button>}
      <Toggle checked={personalize} onChange={setPersonalize} label="Use my champion pool" disabled={poolMissing !== null} hint={poolMissing ?? "Favours champions you have mastery on and play in this role. Mastery counts more than recent games."} />
      <Toggle checked={spells} onChange={setSpells} label="Also set summoner spells" />
      <Toggle checked={items} onChange={setItems} label="Also import item sets" />
      <Toggle checked={autoImport} onChange={setAutoImport} label="Auto-import on lock-in" hint="Imports as soon as you lock in." />
      {isTauri && <Toggle checked={clickActions} onChange={setClickActions} label="Click suggestions in the League client" hint="Adds buttons to the suggestions that act on YOUR own turn: Hover your pick before and during the bans, Ban on your ban turn, Lock in on your pick turn (Ban and Lock in ask you to confirm). One click = one action, nothing happens automatically." />}
      <div className="ml-auto flex items-center gap-3">
        {draft.active && <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted" title="Time left in this phase"><Timer size={14} aria-hidden />{draft.secondsLeft}s</span>}
        <Button variant="ghost" onClick={() => void applyCompact(!compact)}>{compact ? <Maximize2 size={14} aria-hidden /> : <Minimize2 size={14} aria-hidden />}{compact ? "Full view" : "Compact view"}</Button>
      </div>
    </div>
    {!draft.active ? <div className="glass rounded-lg py-16 flex flex-col items-center gap-3 text-sm text-muted"><Swords size={28} aria-hidden />Waiting for champ select…</div> : (
      // Board on top, the assistant panels full width underneath (more room, easier to read). Compact mode puts the panels first.
      <div className="flex flex-col gap-6">
        <div className={compact ? "order-2" : ""}>
          <DraftBoard layout={compact ? "stacked" : "wide"} />
        </div>
        <aside aria-label="Draft assistant" className={compact ? "order-1 space-y-6" : "space-y-6"}>
          <DraftInsights d={d} slots={draft.slots} active={draft.active}>
            {banSuggestions.length > 0 && me?.role && <BanSuggestions bans={banSuggestions} role={me.role} source={source} pool={poolSource} onHover={canClick && draft.myActions.ban !== null ? (c) => void actInChampSelect("ban", "hover", c) : undefined} onBan={canClick && draft.myActions.ban !== null ? (c) => void actInChampSelect("ban", "commit", c) : undefined} />}
            {recs.length > 0 && me?.role && <Recommendations recs={recs} role={me.role} source={source} onHover={canClick && draft.myActions.pick !== null ? (c) => void actInChampSelect("pick", "hover", c) : undefined} onLock={canClick && draft.myActions.pickLive ? (c) => void actInChampSelect("pick", "commit", c) : undefined} />}
          </DraftInsights>
        </aside>
      </div>)}
    </>}
  </>);
}

import { motion } from "framer-motion";
import { type Slot } from "@apex/lcu-core";
import { ChampIcon } from "../components/ChampIcon";
import { Button, spring } from "../components/ui";
import { applyCompact } from "../lib/compact";
import { isTauri } from "../lib/tauri";
import { useUi } from "../lib/store";
import { useEffect, useMemo, useState } from "react";
import { isInGame } from "@apex/lcu-core";
import { Tabs } from "../components/Tabs";
import { RiotIdPrompt } from "../components/RiotIdPrompt";
import { LiveGameView } from "./LiveGameView";
import { createRealData, evaluate, familiarity, poolForRole, poolNote, poolZ, recommend, recommendBans, resolve, teamComp, type PoolChampion } from "@apex/draft-engine";
import { FilterBar } from "../components/FilterBar";
import { useDraftStats, usePool } from "../lib/api";
import { useDdChampions } from "../lib/ddragon";
import { BanSuggestions, CompAnalysis, Recommendations, WinProbability } from "./DraftPanels";
import { champId, champName, runImport, useDraft } from "../lib/lcu";
import { Download, Maximize2, Minimize2, Plus, RotateCcw, Swords, Timer, Undo2, Unplug, X } from "lucide-react";
import { ChampionPicker } from "../components/ChampionPicker";
import { addBan, applyWhatIf, canUndo, editedCells, emptyWhatIf, isDirty, removeBan, reset, resetPick, setPick, takenChampions, undo, type Team } from "../lib/whatIf";

/** What the champion picker is currently choosing for: a team slot or a ban for one team. */
type Target = { kind: "slot"; cellId: number } | { kind: "ban"; team: Team } | null;

/** A small pill toggle (checkbox inside, so it stays a real, labelled checkbox for keyboard and screen readers). The explanation is the tooltip. */
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return <label title={hint} className="h-8 px-3 rounded-full border border-line/10 inline-flex items-center gap-2 text-xs cursor-pointer hover:bg-raised/40 focus-within:ring-2 focus-within:ring-accent/60">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-[rgb(var(--accent))]" />{label}</label>;
}

function SlotCard({ s, selected, edited, onSelect, onReset }: { s: Slot; selected: boolean; edited: boolean; onSelect: () => void; onReset: () => void }) {
  const id = s.locked ? s.championId : s.hoverId, key = champId(id);
  return (
    <div className="relative">
      <motion.button type="button" layout transition={spring} animate={{ scale: s.locked ? 1 : 0.98 }} onClick={onSelect} aria-pressed={selected}
        aria-label={`${s.team === "ally" ? "Your team" : "Enemy team"} ${s.role ?? "slot"}: ${id ? champName(id) : "empty"}. Click to try another champion`}
        className={`focus-ring glass rounded-lg h-16 w-full px-3 flex items-center gap-3 text-left border ${s.locked ? "border-accent/60 shadow-glow" : "border-line/10"} ${selected ? "ring-2 ring-accent" : s.isLocal ? "ring-1 ring-gold/60" : ""}`}>
        <span className={s.locked || !id ? "" : "opacity-50"}>{key ? <ChampIcon id={key} name={champName(id)} size={40} /> : <span className="block size-10 rounded-md bg-raised/70" />}</span>
        <span className="min-w-0"><span className="block text-sm font-medium truncate">{id ? champName(id) : "Picking…"}</span>
          <span className="block text-[11px] text-muted">{s.role ?? "—"}{s.isLocal ? " · you" : ""}{!s.locked && id ? " · hovering" : ""}</span></span>
        {s.locked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className={`ml-auto text-[10px] font-semibold ${edited ? "text-gold" : "text-accent"}`}>{edited ? "WHAT-IF" : "LOCKED"}</motion.span>}
      </motion.button>
      {edited && <button type="button" onClick={onReset} title="Back to the real pick" aria-label="Back to the real pick"
        className="focus-ring absolute -top-1.5 -right-1.5 size-5 rounded-full bg-raised border border-line/20 grid place-items-center hover:bg-bad/60"><X size={12} /></button>}
    </div>
  );
}

export function Draft() {
  const champsQ = useDdChampions(), champs = champsQ.data; // also re-renders once the full champion list has loaded
  // Suggestions come only from games the collector has stored for the current filters.
  const statsQ = useDraftStats(), stats = statsQ.data, myId = useUi((s) => s.myRiotId);
  const data = useMemo(() => {
    if (!champs || !stats || stats.games === 0) return null;
    const tags = new Map(champs.map((c) => [c.key, c.tags]));
    return createRealData(stats, new Map(champs.map((c) => [c.id, c.key])), (k) => tags.get(k) ?? []);
  }, [champs, stats]);
  const source = stats && stats.games > 0 ? `${stats.games.toLocaleString()} collected games` : "";
  const poolSource = "your mastery and recent games";
  const { draft, autoImport, setAutoImport, spells, setSpells, items, setItems } = useDraft();
  const compact = useUi((s) => s.compact);
  // Champ select first, then the live game of the same match. The tab follows the League client's phase; you can still click the other one.
  const gameOn = draft.gameflow === "GameStart" || isInGame(draft.gameflow);
  const [tab, setTab] = useState<"draft" | "live">(gameOn ? "live" : "draft");
  useEffect(() => { if (draft.gameflow === "ChampSelect") setTab("draft"); else if (gameOn) setTab("live"); }, [draft.gameflow, gameOn]);
  // What-if layer (G.3): your edits on top of the real draft. Everything Apex shows and evaluates uses `view`; the League client only ever sees `draft`.
  const [wi, setWi] = useState(emptyWhatIf), [target, setTarget] = useState<Target>(null);
  const view = useMemo(() => applyWhatIf(draft.slots, draft.bans, wi), [draft.slots, draft.bans, wi]);
  useEffect(() => { if (!draft.active) { setWi(reset()); setTarget(null); } }, [draft.active]); // a new champ select starts clean
  const realMe = draft.slots.find((x) => x.isLocal), myKey = realMe ? (realMe.locked ? realMe.championId : realMe.hoverId) : 0; // Import writes the REAL pick
  const me = view.slots.find((x) => x.isLocal);
  const [personalize, setPersonalize] = useState(true), poolQ = usePool(myId);
  // Your pool (mastery plus recent games per role), keyed by numeric champion key ...
  const poolAll = useMemo<PoolChampion[] | null>(() => {
    if (!poolQ.data || !champs) return null;
    const key = new Map(champs.map((c) => [c.id, c.key]));
    return poolQ.data.filter((p) => key.has(p.champion)).map((p) => ({ champion: key.get(p.champion)!, points: p.points,
      byRole: Object.fromEntries((p.byRole ?? []).map((r) => [r.role, { games: r.games, wins: r.wins }])) }));
  }, [poolQ.data, champs]);
  // ... cut down to the role you are playing now: a champion you only play in another role (your top-lane Irelia in a jungle game) is not part of it.
  const pool = useMemo(() => (data && poolAll && me?.role ? new Map(poolForRole(poolAll, me.role, data.roles).map((p) => [p.champion, p] as const)) : null), [data, poolAll, me?.role]);
  const picks = useMemo(() => {
    const locked = (t: Slot["team"]) => view.slots.filter((s) => s.team === t && s.locked).map((s) => ({ champion: s.championId, role: s.role }));
    return { ally: locked("ally"), enemy: locked("enemy") };
  }, [view.slots]);
  const ev = useMemo(() => (data && draft.active ? evaluate(picks.ally, picks.enemy, data) : null), [data, draft.active, picks]);
  // Team composition of the locked picks. Same data as the engine's layer B, so the panel shows what the win probability used.
  const comps = useMemo(() => (data && draft.active ? { ally: teamComp(resolve(picks.ally, data), (c, r) => data.profile?.(c, r), data.tags), enemy: teamComp(resolve(picks.enemy, data), (c, r) => data.profile?.(c, r), data.tags) } : null), [data, draft.active, picks]);
  const recs = useMemo(() => {
    if (!data || !champs || !draft.active || draft.banning || !me?.role || me.locked) return [];
    const t0 = performance.now();
    const exclude = takenChampions(view.slots, view.bans);
    const r = recommend(picks.ally, picks.enemy, me.role, champs.map((c) => c.key), data, {
      exclude, limit: 6,
      personal: (c) => { const p = personalize ? pool?.get(c) : null; return p && (p.points > 0 || p.games > 0) ? { z: poolZ(data.strength(c), p), note: `You: ${poolNote(p)}` } : null; },
    });
    if (import.meta.env.DEV) console.info(`[perf] draft eval ${(performance.now() - t0).toFixed(1)} ms (budget 150)`);
    return r;
  }, [data, champs, draft.active, draft.banning, view, picks, me, pool, personalize]);
  const banSuggestions = useMemo(() => {
    if (!data || !champs || !draft.banning || !me?.role) return [];
    const exclude = takenChampions(view.slots, view.bans);
    return recommendBans(me.role, champs.map((c) => c.key), data, personalize && pool ? [...pool.values()].map((p) => ({ champion: p.champion, games: p.games, weight: familiarity(p.points, p.games) })).filter((p) => p.weight > 0) : [], { exclude, limit: 5 });
  }, [data, champs, draft.banning, view, me, pool, personalize]);
  const team = (t: Slot["team"]) => view.slots.filter((x) => x.team === t);
  const edited = editedCells(wi), taken = takenChampions(view.slots, view.bans);
  const targetSlot = target?.kind === "slot" ? view.slots.find((x) => x.cellId === target.cellId) : undefined;
  const pickTitle = target?.kind === "ban" ? `Ban for ${target.team === "ally" ? "your team" : "the enemy team"}` : targetSlot ? `Lock into ${targetSlot.role ?? "slot"} · ${targetSlot.team === "ally" ? "your team" : "enemy team"}` : "";
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight mb-5">Draft</h1>
    {!draft.connected && <div role="status" className="glass rounded-lg px-4 py-3 mb-5 text-sm text-muted flex items-center gap-3"><Unplug size={16} aria-hidden />League client not detected. Start it and Apex connects automatically.</div>}
    <div className="mb-5"><Tabs id="draft" value={tab} onChange={setTab} tabs={[{ key: "draft", label: "Champ select" }, { key: "live", label: "Live game" }]} /></div>
    {tab === "live" ? (myId ? <LiveGameView id={myId} watch={gameOn} refresh /> : <RiotIdPrompt />) : <>
    <FilterBar />
    <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Draft options">
      {isTauri && <Button variant="ghost" disabled={!draft.connected || !myKey} title={'Writes the rune page, summoner spells and item set(s) the champion page shows (its best build), named "Apex: <champion>"'} onClick={() => void runImport(myKey, me?.role ?? null)}><Download size={14} aria-hidden />Import now</Button>}
      <Toggle checked={personalize} onChange={setPersonalize} label="Use my champion pool" hint="Favours champions you have mastery on and play in this role. Mastery counts more than recent games." />
      <Toggle checked={spells} onChange={setSpells} label="Also set summoner spells" />
      <Toggle checked={items} onChange={setItems} label="Also import item sets" />
      <Toggle checked={autoImport} onChange={setAutoImport} label="Auto-import on lock-in" hint="Imports as soon as you lock in. Off by default." />
      <div className="ml-auto flex items-center gap-3">
        {draft.active && <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted" title="Time left in this phase"><Timer size={14} aria-hidden />{draft.secondsLeft}s</span>}
        <Button variant="ghost" onClick={() => void applyCompact(!compact)}>{compact ? <Maximize2 size={14} aria-hidden /> : <Minimize2 size={14} aria-hidden />}{compact ? "Full view" : "Compact view"}</Button>
      </div>
    </div>
    {!draft.active ? <div className="glass rounded-lg py-16 flex flex-col items-center gap-3 text-sm text-muted"><Swords size={28} aria-hidden />Waiting for champ select…</div> : (
      // Board on the left, assistant panels on the right. Compact mode stacks them with the panels first.
      <div className={compact ? "flex flex-col gap-4" : "grid grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"}>
        <div className={compact ? "order-2" : ""}>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Button variant="ghost" disabled={!canUndo(wi)} onClick={() => setWi(undo(wi))} title="Undo the last what-if change"><Undo2 size={14} />Undo</Button>
            <Button variant="ghost" disabled={!isDirty(wi)} onClick={() => { setWi(reset()); setTarget(null); }} title="Back to the real draft"><RotateCcw size={14} />Reset</Button>
            {isDirty(wi) ? <span className="text-xs font-semibold text-gold" title="Win probability and suggestions use your what-if edits. Your game is not changed.">WHAT-IF</span>
              : <span className="text-xs text-muted" title="Click a slot, or + next to the bans, to try a champion. Only Apex changes, never your game.">Click a slot to try a pick</span>}
          </div>
          <div className="flex gap-6 mb-4 text-xs text-muted">{(["ally", "enemy"] as const).map((t) => <div key={t} className="flex items-center gap-2">{t === "ally" ? "Your bans" : "Enemy bans"}
            {view.bans[t].map((b) => champId(b) && (wi.bans[t].includes(b)
              ? <button key={b} type="button" title="Remove this what-if ban" aria-label={`Remove ban ${champName(b)}`} onClick={() => setWi(removeBan(wi, t, b))} className="focus-ring rounded-md ring-1 ring-gold/60"><ChampIcon id={champId(b)!} name={champName(b)} size={24} /></button>
              : <ChampIcon key={b} id={champId(b)!} name={champName(b)} size={24} />))}
            <button type="button" title="Ban a champion (what-if)" aria-label={`Add a ${t === "ally" ? "your team" : "enemy"} ban`} onClick={() => setTarget({ kind: "ban", team: t })}
              className="focus-ring size-6 rounded-md border border-dashed border-line/30 grid place-items-center hover:bg-raised"><Plus size={14} /></button></div>)}</div>
          {target && champs && (targetSlot || target.kind === "ban") && <div className="mb-4"><ChampionPicker champs={champs} taken={taken} title={pickTitle} onClose={() => setTarget(null)}
            onPick={(k) => { setWi(target.kind === "ban" ? addBan(wi, target.team, k) : setPick(wi, target.cellId, k)); setTarget(null); }}
            onClear={target.kind === "slot" ? () => { setWi(setPick(wi, target.cellId, 0)); setTarget(null); } : undefined} /></div>}
          <div className={`grid ${compact ? "grid-cols-1 gap-3" : "grid-cols-2 gap-4"}`}>{(["ally", "enemy"] as const).map((t) => <div key={t} className="space-y-2">
            <div className="text-sm font-medium">{t === "ally" ? "Your team" : "Enemy team"}</div>{team(t).map((s) => <SlotCard key={s.cellId} s={s} selected={target?.kind === "slot" && target.cellId === s.cellId} edited={edited.has(s.cellId)}
              onSelect={() => setTarget(target?.kind === "slot" && target.cellId === s.cellId ? null : { kind: "slot", cellId: s.cellId })} onReset={() => setWi(resetPick(wi, s.cellId))} />)}</div>)}</div>
        </div>
        <aside aria-label="Draft assistant" className={compact ? "order-1 space-y-4" : "space-y-4"}>
          {champsQ.isError && <div className="glass rounded-lg p-4 text-sm text-muted">Champion data from Riot’s Data Dragon couldn’t be loaded (offline?), so there is no win probability or suggestions.</div>}
          {banSuggestions.length > 0 && me?.role && <BanSuggestions bans={banSuggestions} role={me.role} source={source} pool={poolSource} />}
          {!data && !champsQ.isError && <div role="status" className="glass rounded-lg p-4 text-sm text-muted">{statsQ.isError ? (statsQ.error as Error).message : statsQ.isLoading ? "Loading collected statistics…" : "No collected games for these filters yet, so there are no suggestions. The collector gathers them in the background; check its progress in Settings."}</div>}
          {ev && <WinProbability ev={ev} source={source} games={stats?.games ?? 0} />}
          {comps && comps.ally.picks + comps.enemy.picks > 0 && <CompAnalysis ally={comps.ally} enemy={comps.enemy} />}
          {recs.length > 0 && me?.role && <Recommendations recs={recs} role={me.role} source={source} />}
        </aside>
      </div>)}
    </>}
  </>);
}

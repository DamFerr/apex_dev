import { motion } from "framer-motion";
import { type Slot } from "@apex/lcu-core";
import { ChampIcon } from "../components/ChampIcon";
import { Button, spring } from "../components/ui";
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
import { createRealData, evaluate, familiarity, poolForRole, poolNote, poolZ, recommend, recommendBans, resolve, teamComp, type PoolChampion } from "@apex/draft-engine";
import { FilterBar } from "../components/FilterBar";
import { useDraftStats, usePool } from "../lib/api";
import { useDdChampions } from "../lib/ddragon";
import { BanSuggestions, CompAnalysis, Recommendations, WinProbability } from "./DraftPanels";
import { champId, champName, runImport, useDraft } from "../lib/lcu";
import { Download, Maximize2, Minimize2, Swords, Timer, Unplug } from "lucide-react";

/** A small pill toggle (checkbox inside, so it stays a real, labelled checkbox for keyboard and screen readers). The explanation is the tooltip. */
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return <label title={hint} className="h-8 px-3 rounded-full border border-line/10 inline-flex items-center gap-2 text-xs cursor-pointer hover:bg-raised/40 focus-within:ring-2 focus-within:ring-accent/60">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-[rgb(var(--accent))]" />{label}</label>;
}

function SlotCard({ s }: { s: Slot }) {
  const id = s.locked ? s.championId : s.hoverId, key = champId(id);
  return (
    <motion.div layout transition={spring} animate={{ scale: s.locked ? 1 : 0.98 }}
      aria-label={`${s.team === "ally" ? "Your team" : "Enemy team"} ${s.role ?? "slot"}: ${id ? champName(id) : "empty"}`}
      className={`glass rounded-lg h-[4.5rem] w-full px-4 flex items-center gap-4 text-left border ${s.locked ? "border-accent/60 shadow-glow" : "border-line/10"} ${s.isLocal ? "ring-1 ring-gold/60" : ""}`}>
      <span className={s.locked || !id ? "" : "opacity-50"}>{key ? <ChampIcon id={key} name={champName(id)} size={48} /> : <span className="block size-12 rounded-md bg-raised/70" />}</span>
      <span className="min-w-0"><span className="block text-[1rem] font-medium truncate">{id ? champName(id) : "Picking…"}</span>
        <span className="block text-xs text-muted">{s.role ?? "—"}{s.isLocal ? " · you" : ""}{!s.locked && id ? " · hovering" : ""}</span></span>
      {s.locked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="ml-auto text-xs font-semibold text-accent">LOCKED</motion.span>}
    </motion.div>
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
  const { draft, autoImport, setAutoImport, spells, setSpells, items, setItems, clickActions, setClickActions } = useDraft();
  const compact = useUi((s) => s.compact);
  const canClick = isTauri && clickActions && draft.connected;
  // Champ select first, then the live game of the same match. The tab follows the League client's phase; you can still click the other one.
  const gameOn = draft.gameflow === "GameStart" || isInGame(draft.gameflow);
  const [tab, setTab] = useState<"draft" | "live">(gameOn ? "live" : "draft");
  useEffect(() => { if (draft.gameflow === "ChampSelect") setTab("draft"); else if (gameOn) setTab("live"); }, [draft.gameflow, gameOn]);
  const me = draft.slots.find((x) => x.isLocal), myKey = me ? (me.locked ? me.championId : me.hoverId) : 0; // Import writes your real pick
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
    const locked = (t: Slot["team"]) => draft.slots.filter((s) => s.team === t && s.locked).map((s) => ({ champion: s.championId, role: s.role }));
    return { ally: locked("ally"), enemy: locked("enemy") };
  }, [draft.slots]);
  const ev = useMemo(() => (data && draft.active ? evaluate(picks.ally, picks.enemy, data) : null), [data, draft.active, picks]);
  // Team composition of the locked picks. Same data as the engine's layer B, so the panel shows what the win probability used.
  const comps = useMemo(() => (data && draft.active ? { ally: teamComp(resolve(picks.ally, data), (c, r) => data.profile?.(c, r), data.tags), enemy: teamComp(resolve(picks.enemy, data), (c, r) => data.profile?.(c, r), data.tags) } : null), [data, draft.active, picks]);
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
  const team = (t: Slot["team"]) => draft.slots.filter((x) => x.team === t);
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
      {isTauri && <Toggle checked={clickActions} onChange={setClickActions} label="Click suggestions in the League client" hint="Adds buttons to the suggestions that act on YOUR own turn: Hover your pick before and during the bans, Ban on your ban turn, Lock in on your pick turn (Ban and Lock in ask you to confirm). One click = one action, nothing happens automatically. Off by default." />}
      <div className="ml-auto flex items-center gap-3">
        {draft.active && <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted" title="Time left in this phase"><Timer size={14} aria-hidden />{draft.secondsLeft}s</span>}
        <Button variant="ghost" onClick={() => void applyCompact(!compact)}>{compact ? <Maximize2 size={14} aria-hidden /> : <Minimize2 size={14} aria-hidden />}{compact ? "Full view" : "Compact view"}</Button>
      </div>
    </div>
    {!draft.active ? <div className="glass rounded-lg py-16 flex flex-col items-center gap-3 text-sm text-muted"><Swords size={28} aria-hidden />Waiting for champ select…</div> : (
      // Board on top, the assistant panels full width underneath (more room, easier to read). Compact mode puts the panels first.
      <div className="flex flex-col gap-6">
        <div className={compact ? "order-2" : ""}>
          <div className="flex gap-8 mb-4 text-sm text-muted">{(["ally", "enemy"] as const).map((t) => <div key={t} className="flex items-center gap-2.5">{t === "ally" ? "Your bans" : "Enemy bans"}
            {draft.bans[t].map((b) => champId(b) && <ChampIcon key={b} id={champId(b)!} name={champName(b)} size={32} />)}</div>)}</div>
          <div className={`grid ${compact ? "grid-cols-1 gap-4" : "grid-cols-2 gap-8"}`}>{(["ally", "enemy"] as const).map((t) => <div key={t} className="space-y-3">
            <div className="font-display text-lg font-semibold">{t === "ally" ? "Your team" : "Enemy team"}</div>{team(t).map((s) => <SlotCard key={s.cellId} s={s} />)}</div>)}</div>
        </div>
        <aside aria-label="Draft assistant" className={compact ? "order-1 space-y-6" : "space-y-6"}>
          {champsQ.isError && <div className="glass rounded-lg p-6 text-sm text-muted">Champion data from Riot’s Data Dragon couldn’t be loaded (offline?), so there is no win probability or suggestions.</div>}
          {!data && !champsQ.isError && <div role="status" className="glass rounded-lg p-6 text-sm text-muted">{statsQ.isError ? (statsQ.error as Error).message : statsQ.isLoading ? "Loading collected statistics…" : "No collected games for these filters yet, so there are no suggestions. The collector gathers them in the background; check its progress in Settings."}</div>}
          {ev && <WinProbability ev={ev} source={source} games={stats?.games ?? 0} />}
          {banSuggestions.length > 0 && me?.role && <BanSuggestions bans={banSuggestions} role={me.role} source={source} pool={poolSource} onHover={canClick && draft.myActions.ban !== null ? (c) => void actInChampSelect("ban", "hover", c) : undefined} onBan={canClick && draft.myActions.ban !== null ? (c) => void actInChampSelect("ban", "commit", c) : undefined} />}
          {recs.length > 0 && me?.role && <Recommendations recs={recs} role={me.role} source={source} onHover={canClick && draft.myActions.pick !== null ? (c) => void actInChampSelect("pick", "hover", c) : undefined} onLock={canClick && draft.myActions.pickLive ? (c) => void actInChampSelect("pick", "commit", c) : undefined} />}
          {comps && comps.ally.picks + comps.enemy.picks > 0 && <CompAnalysis ally={comps.ally} enemy={comps.enemy} />}
        </aside>
      </div>)}
    </>}
  </>);
}

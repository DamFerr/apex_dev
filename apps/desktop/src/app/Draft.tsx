import { AnimatePresence, motion } from "framer-motion";
import { type Slot } from "@apex/lcu-core";
import { ChampIcon } from "../components/ChampIcon";
import { Button, spring } from "../components/ui";
import { applyCompact } from "../lib/compact";
import { isTauri } from "../lib/tauri";
import { useUi } from "../lib/store";
import { useMemo, useState } from "react";
import { createRealData, evaluate, personalZ, recommend, recommendBans } from "@apex/draft-engine";
import { FilterBar } from "../components/FilterBar";
import { useDraftStats, usePool } from "../lib/api";
import { useDdChampions } from "../lib/ddragon";
import { BanSuggestions, Recommendations, WinProbability } from "./DraftPanels";
import { champId, champName, MOCK_HOST, runImport, useDraft } from "../lib/lcu";

const post = (s: string) => fetch(`http://${MOCK_HOST}/scenario/${s}`, { method: "POST" }).catch(() => undefined);

function SlotCard({ s }: { s: Slot }) {
  const id = s.locked ? s.championId : s.hoverId, key = champId(id);
  return (
    <motion.div layout transition={spring} animate={{ scale: s.locked ? 1 : 0.98 }}
      className={`glass rounded-lg h-16 px-3 flex items-center gap-3 border ${s.locked ? "border-accent/60 shadow-glow" : "border-line/10"} ${s.isLocal ? "ring-1 ring-gold/60" : ""}`}>
      <div className={s.locked || !id ? "" : "opacity-50"}>{key ? <ChampIcon id={key} name={champName(id)} size={40} /> : <div className="size-10 rounded-md bg-raised/70" />}</div>
      <div className="min-w-0"><div className="text-sm font-medium truncate">{id ? champName(id) : "Picking…"}</div>
        <div className="text-[11px] text-muted">{s.role ?? "—"}{s.isLocal ? " · you" : ""}{!s.locked && id ? " · hovering" : ""}</div></div>
      {s.locked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="ml-auto text-[10px] text-accent font-semibold">LOCKED</motion.span>}
    </motion.div>
  );
}

export function Draft() {
  const champsQ = useDdChampions(), champs = champsQ.data; // also re-renders once the full champion list has loaded
  // Suggestions come only from the games the collector has stored for the current filters. Without games there is nothing to suggest (no made-up numbers).
  const statsQ = useDraftStats(), stats = statsQ.data, myId = useUi((s) => s.myRiotId);
  const real = !!stats && stats.games > 0;
  const data = useMemo(() => {
    if (!champs || !stats || !real) return null;
    const tags = new Map(champs.map((c) => [c.key, c.tags]));
    return createRealData(stats, new Map(champs.map((c) => [c.id, c.key])), (k) => tags.get(k) ?? []);
  }, [champs, stats, real]);
  const source = real ? `${stats!.games.toLocaleString()} collected games` : "no collected games";
  const poolSource = "your recent games";
  const { draft, autoImport, setAutoImport, log, spells, setSpells } = useDraft();
  const src = useUi((s) => s.lcuSource), mock = src === "mock", compact = useUi((s) => s.compact);
  const me = draft.slots.find((x) => x.isLocal), myKey = me ? (me.locked ? me.championId : me.hoverId) : 0;
  const [personalize, setPersonalize] = useState(true), poolQ = usePool(myId);
  // Your pool (recent games plus mastery with the local backend, a demo player otherwise), keyed by numeric champion key.
  const pool = useMemo(() => {
    if (!poolQ.data || !champs) return null;
    const key = new Map(champs.map((c) => [c.id, c.key]));
    return new Map(poolQ.data.filter((p) => key.has(p.champion)).map((p) => [key.get(p.champion)!, p] as const));
  }, [poolQ.data, champs]);
  const picks = useMemo(() => {
    const locked = (t: Slot["team"]) => draft.slots.filter((s) => s.team === t && s.locked).map((s) => ({ champion: s.championId, role: s.role }));
    return { ally: locked("ally"), enemy: locked("enemy") };
  }, [draft.slots]);
  const ev = useMemo(() => (data && draft.active ? evaluate(picks.ally, picks.enemy, data) : null), [data, draft.active, picks]);
  const recs = useMemo(() => {
    if (!data || !champs || !draft.active || draft.banning || !me?.role || me.locked) return [];
    const t0 = performance.now();
    const exclude = new Set([...draft.slots.filter((s) => s.locked).map((s) => s.championId), ...draft.bans.ally, ...draft.bans.enemy]);
    const r = recommend(picks.ally, picks.enemy, me.role, champs.map((c) => c.key), data, {
      exclude, limit: 6,
      personal: (c) => { const p = personalize ? pool?.get(c) : null; return p ? { z: personalZ(data.strength(c), p.wins, p.games), note: `You: ${Math.round((100 * p.wins) / p.games)}% in ${p.games} games` } : null; },
    });
    if (import.meta.env.DEV) console.info(`[perf] draft eval ${(performance.now() - t0).toFixed(1)} ms (budget 150)`);
    return r;
  }, [data, champs, draft.active, draft.banning, draft.slots, draft.bans, picks, me, pool, personalize]);
  const banSuggestions = useMemo(() => {
    if (!data || !champs || !draft.banning || !me?.role) return [];
    const exclude = new Set([...draft.bans.ally, ...draft.bans.enemy, ...draft.slots.filter((s) => s.locked).map((s) => s.championId)]);
    return recommendBans(me.role, champs.map((c) => c.key), data, personalize && pool ? [...pool.entries()].filter(([, p]) => p.games > 0).map(([champion, p]) => ({ champion, games: p.games })) : [], { exclude, limit: 5 });
  }, [data, champs, draft.banning, draft.bans, draft.slots, me, pool, personalize]);
  const team = (t: Slot["team"]) => draft.slots.filter((x) => x.team === t);
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Draft</h1>
    <p className="text-sm text-muted mt-1 mb-5">Champ select assistant. Source: {src} League client (change in Settings).</p>
    {!draft.connected && <div className="glass rounded-lg p-5 mb-5 text-sm">{mock ? <>Mock League client not running. In a second terminal run <code className="rounded bg-raised px-1.5 py-0.5">pnpm lcu-mock</code>, and this page connects automatically.</> : "League of Legends client not detected. Start the game client (native Apex window only); Apex retries every few seconds."}</div>}
    <FilterBar />
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <Button disabled={!draft.connected || !mock} onClick={() => post("normal")}>Start mock champ select</Button>
      <Button variant="ghost" disabled={!draft.connected || !mock} onClick={() => post("dodge")}>Start dodge scenario</Button>
      <Button variant="ghost" disabled={!draft.connected || !mock} onClick={() => post("reset")}>Reset</Button>
      <Button variant="ghost" disabled={mock || !isTauri || !draft.connected || !myKey} title={'Real client only. Writes a rune page named "Apex: <champion>"'} onClick={() => void runImport(myKey, me?.role ?? null)}>Import now</Button>
      <Button variant="ghost" onClick={() => void applyCompact(!compact)}>{compact ? "Full view" : "Compact view"}</Button>
      <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} className="size-4 accent-[rgb(var(--accent))]" />Use my champion pool ({poolSource})</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={spells} onChange={(e) => setSpells(e.target.checked)} className="size-4 accent-[rgb(var(--accent))]" />Also set summoner spells</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoImport} onChange={(e) => setAutoImport(e.target.checked)} className="size-4 accent-[rgb(var(--accent))]" />Auto-import on lock-in <span className="text-xs text-muted">(off by default)</span></label>
    </div>
    <div className="text-xs text-muted mb-3">Game state: {draft.gameflow}{draft.active ? ` · ${draft.secondsLeft}s left` : ""}</div>
    {!draft.active ? <div className="glass rounded-lg p-10 text-sm text-muted">Waiting for champ select…</div> : (
      // Board on the left, assistant panels on the right. Compact mode stacks them with the panels first.
      <div className={compact ? "flex flex-col gap-4" : "grid grid-cols-[minmax(0,1fr)_360px] gap-6 items-start"}>
        <div className={compact ? "order-2" : ""}>
          <div className="flex gap-6 mb-4 text-xs text-muted">{(["ally", "enemy"] as const).map((t) => <div key={t} className="flex items-center gap-2">{t === "ally" ? "Your bans" : "Enemy bans"}
            {draft.bans[t].map((b) => champId(b) && <ChampIcon key={b} id={champId(b)!} name={champName(b)} size={24} />)}</div>)}</div>
          <div className={`grid ${compact ? "grid-cols-1 gap-3" : "grid-cols-2 gap-4"}`}>{(["ally", "enemy"] as const).map((t) => <div key={t} className="space-y-2">
            <div className="text-sm font-medium">{t === "ally" ? "Your team" : "Enemy team"}</div>{team(t).map((s) => <SlotCard key={s.cellId} s={s} />)}</div>)}</div>
        </div>
        <aside aria-label="Draft assistant" className={compact ? "order-1 space-y-4" : "space-y-4"}>
          {draft.active && !real && !statsQ.isLoading && <div className="glass rounded-lg p-4 text-sm text-muted">{statsQ.isError ? (statsQ.error as Error).message : "No collected games for these filters yet, so there are no suggestions. The collector fills this in over time: try “All regions”, “All patches” or a lower rank."}</div>}
          {champsQ.isError && <div className="glass rounded-lg p-4 text-sm text-muted">Win probability and suggestions need champion data from Riot’s Data Dragon, which couldn’t be loaded (offline?).</div>}
          {banSuggestions.length > 0 && me?.role && <BanSuggestions bans={banSuggestions} role={me.role} source={source} pool={poolSource} />}
          {ev && <WinProbability ev={ev} source={source} real={real} games={stats?.games ?? 0} />}
          {recs.length > 0 && me?.role && <Recommendations recs={recs} role={me.role} source={source} />}
        </aside>
      </div>)}
    <h2 className="font-display text-lg font-semibold mt-8 mb-2">Import log</h2>
    <ul className="space-y-1 text-sm"><AnimatePresence initial={false}>{log.map((l) => <motion.li key={l.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-md px-3 py-2">{l.text}</motion.li>)}</AnimatePresence>
      {!log.length && <li className="text-muted text-xs">Nothing imported yet. Turn on auto-import, then lock in a champion.</li>}</ul>
  </>);
}

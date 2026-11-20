import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Slot } from "@apex/lcu-core";
import { createRealData, evaluate, resolve, teamComp, teamScaling } from "@apex/draft-engine";
import { ChampIcon } from "../components/ChampIcon";
import { spring } from "../components/ui";
import { useDraftStats } from "../lib/api";
import { useDdChampions } from "../lib/ddragon";
import { champId, champName, useDraft } from "../lib/lcu";
import { CompAnalysis, WinProbability } from "./DraftPanels";

/**
 * The read-only part of champ select, shared by the Draft page and the pick setup page (I.7): both teams with bans, the win-probability bar
 * (champion and matchup win rates, games count) and the team composition. No picking, no suggestions, no import options.
 */

/** Draft statistics for the current filters, turned into engine data (null while loading or when nothing was collected). */
export function useDraftData() {
  const champsQ = useDdChampions(), champs = champsQ.data; // also re-renders once the full champion list has loaded
  const statsQ = useDraftStats(), stats = statsQ.data;
  const data = useMemo(() => {
    if (!champs || !stats || stats.games === 0) return null;
    const tags = new Map(champs.map((c) => [c.key, c.tags]));
    return createRealData(stats, new Map(champs.map((c) => [c.id, c.key])), (k) => tags.get(k) ?? []);
  }, [champs, stats]);
  const source = stats && stats.games > 0 ? `${stats.games.toLocaleString()} collected games` : "";
  return { champsQ, champs, statsQ, stats, data, source };
}
export type DraftData = ReturnType<typeof useDraftData>;

/** Locked picks per team (the engine only evaluates locked champions). */
export function useLockedPicks(slots: Slot[]) {
  return useMemo(() => {
    const locked = (t: Slot["team"]) => slots.filter((s) => s.team === t && s.locked).map((s) => ({ champion: s.championId, role: s.role }));
    return { ally: locked("ally"), enemy: locked("enemy") };
  }, [slots]);
}

export function SlotCard({ s, dense }: { s: Slot; dense?: boolean }) {
  const id = s.locked ? s.championId : s.hoverId, key = champId(id);
  const size = dense ? 32 : 48;
  return (
    <motion.div layout transition={spring} animate={{ scale: s.locked ? 1 : 0.98 }}
      aria-label={`${s.team === "ally" ? "Your team" : "Enemy team"} ${s.role ?? "slot"}: ${id ? champName(id) : "empty"}`}
      className={`glass rounded-lg w-full flex items-center text-left border ${dense ? "h-12 px-2 gap-2" : "h-[4.5rem] px-4 gap-4"} ${s.locked ? "border-accent/60 shadow-glow" : "border-line/10"} ${s.isLocal ? "ring-1 ring-gold/60" : ""}`}>
      <span className={`shrink-0 ${s.locked || !id ? "" : "opacity-50"}`}>{key ? <ChampIcon id={key} name={champName(id)} size={size} /> : <span className={`block rounded-md bg-raised/70 ${dense ? "size-8" : "size-12"}`} />}</span>
      <span className="min-w-0"><span className={`block font-medium truncate ${dense ? "text-sm" : "text-[1rem]"}`}>{id ? champName(id) : "Picking…"}</span>
        <span className="block text-xs text-muted truncate">{s.role ?? "—"}{s.isLocal ? " · you" : ""}{!s.locked && id ? " · hovering" : ""}</span></span>
      {s.locked && !dense && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="ml-auto text-xs font-semibold text-accent">LOCKED</motion.span>}
    </motion.div>
  );
}

/** Bans and both teams. `layout`: "wide" two columns (Draft page), "stacked" one column (compact mode), "dense" two slim columns (side column of the setup page). */
export function DraftBoard({ layout = "wide" }: { layout?: "wide" | "stacked" | "dense" }) {
  const draft = useDraft((s) => s.draft), dense = layout === "dense";
  const team = (t: Slot["team"]) => draft.slots.filter((x) => x.team === t);
  return (<div>
    <div className={`flex flex-wrap mb-4 text-sm text-muted ${dense ? "gap-x-4 gap-y-2" : "gap-8"}`}>{(["ally", "enemy"] as const).map((t) => <div key={t} className="flex items-center gap-2.5">{t === "ally" ? "Your bans" : "Enemy bans"}
      {draft.bans[t].map((b) => champId(b) && <ChampIcon key={b} id={champId(b)!} name={champName(b)} size={dense ? 24 : 32} />)}</div>)}</div>
    <div className={`grid ${layout === "stacked" ? "grid-cols-1 gap-4" : dense ? "grid-cols-2 gap-3" : "grid-cols-2 gap-8"}`}>{(["ally", "enemy"] as const).map((t) => <div key={t} className={dense ? "space-y-2" : "space-y-3"}>
      <div className={`font-display font-semibold ${dense ? "text-sm" : "text-lg"}`}>{t === "ally" ? "Your team" : "Enemy team"}</div>{team(t).map((s) => <SlotCard key={s.cellId} s={s} dense={dense} />)}</div>)}</div>
  </div>);
}

/** Win probability and team composition for the locked picks. Same data and components as the Draft page; `children` (the Draft page's suggestions) sit between the two. */
export function DraftInsights({ d, slots, active, children }: { d: DraftData; slots: Slot[]; active: boolean; children?: ReactNode }) {
  const { data, champsQ, statsQ, stats, source } = d, picks = useLockedPicks(slots);
  const ev = useMemo(() => (data && active ? evaluate(picks.ally, picks.enemy, data) : null), [data, active, picks]);
  const comps = useMemo(() => {
    if (!data || !active) return null;
    const a = resolve(picks.ally, data), e = resolve(picks.enemy, data), sc = (c: number, r: Parameters<NonNullable<typeof data.scaling>>[1]) => data.scaling?.(c, r);
    return { ally: teamComp(a, (c, r) => data.profile?.(c, r), data.tags), enemy: teamComp(e, (c, r) => data.profile?.(c, r), data.tags), allyScaling: teamScaling(a, sc), enemyScaling: teamScaling(e, sc) };
  }, [data, active, picks]);
  return (<>
    {champsQ.isError && <div className="glass rounded-lg p-6 text-sm text-muted">Champion data from Riot’s Data Dragon couldn’t be loaded (offline?), so there is no win probability or suggestions.</div>}
    {!data && !champsQ.isError && <div role="status" className="glass rounded-lg p-6 text-sm text-muted">{statsQ.isError ? (statsQ.error as Error).message : statsQ.isLoading ? "Loading collected statistics…" : "No collected games for these filters yet, so there are no suggestions. The collector gathers them in the background; check its progress in Settings."}</div>}
    {ev && <WinProbability ev={ev} source={source} games={stats?.games ?? 0} />}
    {children}
    {comps && comps.ally.picks + comps.enemy.picks > 0 && <CompAnalysis ally={comps.ally} enemy={comps.enemy} allyScaling={comps.allyScaling} enemyScaling={comps.enemyScaling} />}
  </>);
}

/** Side column of the setup page: the draft context without any picking. Renders nothing outside champ select. */
export function DraftContext() {
  const draft = useDraft((s) => s.draft), d = useDraftData();
  if (!draft.active) return null;
  return (<aside aria-label="Draft context" className="space-y-4 min-w-0">
    <div className="glass rounded-lg p-4"><DraftBoard layout="dense" /></div>
    <DraftInsights d={d} slots={draft.slots} active={draft.active} />
  </aside>);
}

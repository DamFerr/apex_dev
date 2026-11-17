import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emit, listen } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { ChampionBuild, PathItem } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { GameIcon } from "../components/GameIcon";
import { OVERLAY_READY, OVERLAY_STATE, type OverlayPayload } from "../lib/overlay";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5 * 60_000 } } });
const Chev = () => <span aria-hidden className="text-muted/60 text-[10px] leading-none">›</span>;
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-2"><span className="w-12 shrink-0 text-[10px] text-muted">{label}</span><div className="flex items-center gap-1 min-w-0 flex-wrap">{children}</div></div>);
const Items = ({ items }: { items: PathItem[] }) => <>{items.map((i, n) => <GameIcon key={`${i.id}-${n}`} kind="item" id={i.id} name={i.name} count={i.count} size={24} />)}</>;
type Slot = "Q" | "W" | "E" | "R";
const isSlot = (s: string): s is Slot => s === "Q" || s === "W" || s === "E" || s === "R";

function BuildCard({ p }: { p: OverlayPayload }) {
  const b: ChampionBuild | null = p.build, page = b?.runePages[0], boots = b?.itemBlocks.find((x) => x.name === "Boots")?.items[0];
  const none = !b || (!page && !b.skillOrder && !b.corePath && !b.startItems && !boots);
  return (
    <motion.div initial={{ opacity: 0, y: p.reduceMotion ? 0 : -6 }} animate={{ opacity: p.opacity, y: 0 }} transition={{ duration: p.reduceMotion ? 0 : 0.25 }}
      className="m-2 glass rounded-xl p-3 w-[316px] space-y-2.5 text-xs">
      <div className="flex items-center gap-2.5">
        <ChampIcon id={p.champion} name={p.championName} size={36} />
        <div className="min-w-0 mr-auto"><div className="font-display text-sm font-semibold leading-tight truncate">{p.championName}</div><div className="text-[10px] text-muted">{p.role ?? "Any role"} · usual build</div></div>
        {b?.spells && <div className="flex gap-1">{b.spells.ids.map((id) => <GameIcon key={id} kind="spell" id={id} size={24} />)}</div>}
      </div>
      {none && <div className="text-muted">No collected games for {p.championName} yet, so there is no usual build to show. Apex fills this in as its collector gathers games.</div>}
      {page && <Row label="Runes">
        <GameIcon kind="rune" id={page.perkIds[0]} size={28} />{page.perkIds.slice(1, 4).map((r) => <GameIcon key={r} kind="rune" id={r} size={20} />)}
        <span className="mx-0.5 h-4 w-px bg-line/15" aria-hidden />{page.perkIds.slice(4, 6).map((r) => <GameIcon key={r} kind="rune" id={r} size={20} />)}
        <span className="mx-0.5 h-4 w-px bg-line/15" aria-hidden />{page.perkIds.slice(6).map((s, i) => <GameIcon key={i} kind="shard" id={s} size={16} />)}
      </Row>}
      {b?.skillOrder && <>
        <Row label="Max">{b.skillOrder.max.filter(isSlot).map((k, i) => <Fragment key={k}>{i > 0 && <Chev />}<GameIcon kind="ability" champion={p.champion} slot={k} size={24} /></Fragment>)}</Row>
        <Row label="Levels"><span className="flex flex-wrap gap-0.5">{b.skillOrder.levels.filter(isSlot).map((k, i) => <GameIcon key={i} kind="ability" champion={p.champion} slot={k} size={20} />)}</span></Row>
      </>}
      {b?.startItems && <Row label="Start"><Items items={b.startItems.items} /></Row>}
      {(b?.corePath || boots) && <Row label="Items">
        {b?.corePath && b.corePath.items.map((i, n) => <Fragment key={i.id}>{n > 0 && <Chev />}<GameIcon kind="item" id={i.id} name={i.name} size={24} /></Fragment>)}
        {boots && <><span className="mx-0.5 h-4 w-px bg-line/15" aria-hidden /><GameIcon kind="item" id={boots.id} name={boots.name} size={24} /></>}
      </Row>}
      {!none && b && <div className="text-[10px] text-muted">Most played setup of {b.games.toLocaleString()} collected games{b.timelineGames ? ` · skills and items from ${b.timelineGames.toLocaleString()}` : ""}. Stats from before the game, not live.</div>}
    </motion.div>);
}

/**
 * In-game overlay window. Transparent, always on top and click-through (set in Rust, so it never takes mouse or keyboard input from the game).
 * Shows only what was known at champ select: the usual build of the champion you locked, from collected games. It reads no game state.
 * The main window owns the data and sends it here as a Tauri event.
 */
export function Overlay() {
  const [p, setP] = useState<OverlayPayload | null>(null);
  useEffect(() => {
    document.documentElement.dataset.overlay = "1";
    let off: (() => void) | undefined, dead = false;
    void listen<OverlayPayload | null>(OVERLAY_STATE, (e) => setP(e.payload)).then((f) => { if (dead) f(); else { off = f; void emit(OVERLAY_READY); } }); // ask for the current state once listening
    return () => { dead = true; off?.(); };
  }, []);
  useEffect(() => { if (p) { document.documentElement.dataset.theme = p.theme; document.documentElement.dataset.reduceMotion = String(p.reduceMotion); } }, [p]);
  return <QueryClientProvider client={qc}>{p ? <BuildCard p={p} /> : null}</QueryClientProvider>;
}

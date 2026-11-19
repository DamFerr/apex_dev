import { clampOverlayPosition, pageBuild, startItemsLeftMs } from "@apex/lcu-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { Fragment, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { ChampionBuild, PathItem } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { GameIcon } from "../components/GameIcon";
import { OVERLAY_MOVED, OVERLAY_READY, OVERLAY_STATE, OVERLAY_WINDOW, type OverlayLayout, type OverlayMoved, type OverlayPayload } from "../lib/overlay";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5 * 60_000 } } });
const Chev = () => <span aria-hidden className="text-muted/60 text-[10px] leading-none">›</span>;
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center gap-2"><span className="w-12 shrink-0 text-[10px] text-muted">{label}</span><div className="flex items-center gap-1 min-w-0 flex-wrap">{children}</div></div>);
const Items = ({ items }: { items: PathItem[] }) => <>{items.map((i, n) => <GameIcon key={`${i.id}-${n}`} kind="item" id={i.id} name={i.name} count={i.count} size={24} />)}</>;
type Slot = "Q" | "W" | "E" | "R";
const isSlot = (s: string): s is Slot => s === "Q" || s === "W" || s === "E" || s === "R";

/** Quiet period after the last window move before a drag counts as dropped (a drag is a stream of move events; there is no reliable mouse-up). */
const SETTLE_MS = 200;

/**
 * Dragging the card (D.4). Holding the left button on the card starts a native window drag; the Rust side lets the mouse into the window
 * only while the cursor is over the card, so the rest of the overlay stays click-through. When the moves stop, the window is clamped fully
 * onto a monitor (`clampOverlayPosition`), moved there, and the spot is sent to the main window to save. Sends nothing to the game.
 */
function useCardDrag(card: React.RefObject<HTMLDivElement | null>, active: boolean) {
  const dragging = useRef(false), moved = useRef(false), timer = useRef<ReturnType<typeof setTimeout>>();
  // Tell Rust where the card is (logical px in the window), so only that rectangle takes the mouse. Re-sent when the card changes size.
  useEffect(() => {
    const el = card.current;
    if (!active || !el) { void invoke("overlay_card", { x: 0, y: 0, w: 0, h: 0 }).catch(() => undefined); return; }
    const report = () => void invoke("overlay_card", { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }).catch(() => undefined);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => { ro.disconnect(); void invoke("overlay_card", { x: 0, y: 0, w: 0, h: 0 }).catch(() => undefined); };
  }, [card, active]);

  const end = () => { dragging.current = false; moved.current = false; void invoke("overlay_dragging", { on: false }).catch(() => undefined); };
  const settle = async () => {
    end();
    const l = await invoke<OverlayLayout>("overlay_layout").catch(() => null);
    if (!l) return;
    const { window: w, monitors } = l;
    // The monitor under the window's centre owns the spot (the primary one if the centre is off every screen).
    const cx = w.x + w.width / 2, cy = w.y + w.height / 2;
    const m = monitors.find((k) => cx >= k.x && cx < k.x + k.width && cy >= k.y && cy < k.y + k.height) ?? monitors.find((k) => k.primary) ?? monitors[0];
    if (!m) return;
    const c = clampOverlayPosition({ monitorId: m.id, x: (w.x - m.x) / m.scale, y: (w.y - m.y) / m.scale }, monitors, OVERLAY_WINDOW);
    if (!c) return;
    const own = monitors.find((k) => k.id === c.monitorId) ?? m;
    await invoke("overlay_move", { x: c.x, y: c.y }).catch(() => undefined);
    void emit(OVERLAY_MOVED, { monitorId: c.monitorId, x: Math.round((c.x - own.x) / own.scale), y: Math.round((c.y - own.y) / own.scale) } satisfies OverlayMoved);
  };

  useEffect(() => {
    let off: (() => void) | undefined, dead = false;
    void getCurrentWindow().onMoved(() => {
      if (!dragging.current) return;              // moves made by Apex itself (placing the window) are not drags
      moved.current = true;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void settle(), SETTLE_MS);
    }).then((f) => { if (dead) f(); else off = f; });
    // A press without a move never starts the native drag loop, so the release does arrive: just give the mouse back.
    const up = () => { if (dragging.current && !moved.current) end(); };
    window.addEventListener("mouseup", up);
    return () => { dead = true; off?.(); clearTimeout(timer.current); window.removeEventListener("mouseup", up); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps -- settle/end only touch refs and invoke

  return (e: MouseEvent) => {
    if (e.button !== 0) return;                   // left button only
    dragging.current = true; moved.current = false;
    void invoke("overlay_dragging", { on: true }).catch(() => undefined);
    void getCurrentWindow().startDragging().catch(end);
  };
}

function BuildCard({ p }: { p: OverlayPayload }) {
  const card = useRef<HTMLDivElement>(null);
  const onDown = useCardDrag(card, true);
  // Start items are only useful in the first seconds: hide them a fixed time after the overlay appeared. A plain timer, not your inventory (that would be game state).
  const [showStart, setShowStart] = useState(() => startItemsLeftMs(p.shownAt, Date.now()) > 0);
  useEffect(() => {
    const left = startItemsLeftMs(p.shownAt, Date.now());
    setShowStart(left > 0);
    if (p.shownAt === null || left <= 0) return;
    const t = setTimeout(() => setShowStart(false), left);
    return () => clearTimeout(t);
  }, [p.shownAt]);
  const full: ChampionBuild | null = p.build, b = full ? pageBuild(full).core : null;   // the same build the champion page shows (best variant)
  // The same boots rule as the champion page: the usual boots sit inside the build order, where they are bought; a separate boots icon is only shown when the order has none.
  const order = b?.buildOrder ?? b?.corePath ?? null, bootsList = b?.itemBlocks.find((x) => x.name === "Boots")?.items ?? [];
  const bootsIds = new Set(bootsList.map((x) => x.id)), boots = order?.items.some((i) => bootsIds.has(i.id)) ? undefined : bootsList[0];
  const none = !b || (!b.skillOrder && !order && !b.startItems && !boots);
  return (
    <motion.div ref={card} onMouseDown={onDown} initial={{ opacity: 0, y: p.reduceMotion ? 0 : -6 }} animate={{ opacity: p.opacity, y: 0 }} transition={{ duration: p.reduceMotion ? 0 : 0.25 }}
      className="m-2 glass rounded-xl p-3 w-[316px] space-y-2.5 text-xs cursor-grab active:cursor-grabbing select-none">
      <div className="flex items-center gap-2.5">
        <ChampIcon id={p.champion} name={p.championName} size={36} />
        <div className="min-w-0 mr-auto"><div className="font-display text-sm font-semibold leading-tight truncate">{p.championName}</div><div className="text-[10px] text-muted">{p.role ?? "Any role"} · usual build</div></div>
      </div>
      {none && <div className="text-muted">No collected games for {p.championName} yet, so there is no usual build to show. Apex fills this in as its collector gathers games.</div>}
      {b?.skillOrder && <>
        <Row label="Max">{b.skillOrder.max.filter(isSlot).map((k, i) => <Fragment key={k}>{i > 0 && <Chev />}<GameIcon kind="ability" champion={p.champion} slot={k} size={24} /></Fragment>)}</Row>
        <Row label="Levels"><span className="flex flex-wrap gap-0.5">{b.skillOrder.levels.filter(isSlot).map((k, i) => <GameIcon key={i} kind="ability" champion={p.champion} slot={k} size={20} />)}</span></Row>
      </>}
      {showStart && b?.startItems && <Row label="Start"><Items items={b.startItems.items} /></Row>}
      {(order || boots) && <Row label="Items">
        {order && order.items.map((i, n) => <Fragment key={i.id}>{n > 0 && <Chev />}<GameIcon kind="item" id={i.id} name={i.name} size={24} /></Fragment>)}
        {boots && <>{order && <span className="mx-0.5 h-4 w-px bg-line/15" aria-hidden />}<GameIcon kind="item" id={boots.id} name={boots.name} size={24} /></>}
      </Row>}
    </motion.div>);
}

/**
 * In-game overlay window. Transparent, always on top, never takes keyboard focus, and click-through except over the card, which can be dragged
 * at any time (D.4; Rust switches click-through by cursor position, so the game keeps every click outside the card).
 * Shows only what was known at champ select: skill order, starting items and build order of the champion you locked, from collected games (no runes or summoner spells, D.1). It reads no game state.
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

import { Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Search, Square, Star, User, UserSearch, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NAV, SETTINGS_ITEM, buildPaletteEntries, type NavItem, type PaletteEntry } from "../lib/nav";
import { ChampIcon } from "../components/ChampIcon";
import { useUi } from "../lib/store";
import { publicPatch } from "@apex/schema";
import { useStoredPlayers } from "../lib/api";
import { win } from "../lib/tauri";
import { Skeleton, spring } from "../components/ui";
import { preload } from "./lazyPages";
import { useDraft } from "../lib/lcu";
import { useDdChampions, useDdVersion } from "../lib/ddragon";
import { applyCompact } from "../lib/compact";
import { Toaster } from "../components/Toaster";

function TitleBar() {
  const setPalette = useUi((s) => s.setPalette);
  const btn = "h-full w-11 grid place-items-center text-muted hover:text-text hover:bg-line/10 focus-ring";
  return (
    <header data-tauri-drag-region className="h-10 flex items-center justify-between pl-4 border-b border-line/10 bg-surface/60 backdrop-blur-xl">
      <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
        <div className="size-4 rounded-sm bg-accent shadow-glow" />
        <span className="font-display text-sm font-semibold">Apex</span>
      </div>
      <button onClick={() => setPalette(true)} className="focus-ring hidden md:flex items-center gap-2 h-7 w-80 px-3 rounded-md bg-raised/60 border border-line/10 text-xs text-muted hover:text-text">
        <Search size={14} /> Search champions, players, pages
        <kbd className="ml-auto rounded border border-line/15 px-1.5 text-[10px]">Ctrl K</kbd>
      </button>
      <div className="flex h-full">
        <button aria-label="Minimize" className={btn} onClick={win.minimize}><Minus size={15} /></button>
        <button aria-label="Maximize" className={btn} onClick={win.toggleMax}><Square size={12} /></button>
        <button aria-label="Close" className={btn + " hover:!bg-bad/80 hover:!text-white"} onClick={win.close}><X size={16} /></button>
      </div>
    </header>
  );
}

function SideLink({ item, open }: { item: NavItem; open: boolean }) {
  return (
    <NavLink to={item.path} end={item.path === "/"} aria-label={item.label} onMouseEnter={() => void preload[item.path]?.()} onFocus={() => void preload[item.path]?.()}
      className={({ isActive }) => `focus-ring relative flex items-center gap-3 h-10 px-[9px] rounded-md text-sm transition-colors ${
        isActive ? "bg-accent/15 text-text" : "text-muted hover:text-text hover:bg-line/5"}`}>
      {({ isActive }) => (<>
        {isActive && <motion.span layoutId="nav-pill" transition={spring} className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent shadow-glow" />}
        <item.icon size={18} className="shrink-0" />
        <span className={`whitespace-nowrap transition-opacity duration-150 ${open ? "opacity-100 delay-100" : "opacity-0"}`}>{item.label}</span>
      </>)}
    </NavLink>
  );
}

function Sidebar() {
  const [open, setOpen] = useState(false), t = useRef(0);
  const clear = () => window.clearTimeout(t.current);
  // Only the 36px icon column opens it (after 80 ms); closing waits 200 ms, so edge flicker can't happen.
  const openSoon = () => { clear(); t.current = window.setTimeout(() => setOpen(true), 80); };
  const closeSoon = () => { clear(); t.current = window.setTimeout(() => setOpen(false), 200); };
  const hot = { onMouseEnter: openSoon, onMouseLeave: () => { if (!open) clear(); } };
  return (
    <nav aria-label="Main" onMouseEnter={() => open && clear()} onMouseLeave={closeSoon} onFocus={() => { clear(); setOpen(true); }} onBlur={closeSoon}
      className={`${open ? "w-52" : "w-[60px]"} shrink-0 overflow-hidden transition-[width] duration-200 ease-out border-r border-line/10 bg-surface/50 backdrop-blur-xl flex flex-col justify-between px-3 py-2 z-30`}>
      <div className="space-y-1" {...hot}>{NAV.map((n) => <SideLink key={n.path} item={n} open={open} />)}</div>
      <div {...hot}><SideLink item={SETTINGS_ITEM} open={open} /></div>
    </nav>
  );
}

function StatusArea() {
  const connected = useDraft((s) => s.draft.connected), ver = useDdVersion().data;
  return (
    <footer className="h-7 flex items-center justify-between px-4 text-[11px] text-muted border-t border-line/10 bg-surface/60">
      <span className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${connected ? "bg-good" : "bg-gold"}`} /> League client: {connected ? "connected" : "not connected"}</span>
      <span title={ver ? `Data Dragon ${ver}` : undefined}>{ver ? `Patch ${publicPatch(ver)}` : "Patch unavailable (offline)"}</span>
    </footer>
  );
}

function CommandPalette() {
  const { paletteOpen, setPalette, favourites, recent, addRecent, toggleFavourite } = useUi();
  const nav = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);
  const [q, setQ] = useState(""); const [i, setI] = useState(0);
  const prevFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { if (paletteOpen) prevFocus.current = document.activeElement as HTMLElement; else prevFocus.current?.focus?.(); }, [paletteOpen]);
  const champs = useDdChampions().data, stored = useStoredPlayers(q, paletteOpen);
  const items = useMemo(() => buildPaletteEntries(q, champs, { favourites, recent, stored }), [q, champs, favourites, recent, stored]);
  // Keep the highlighted row visible when arrowing through a long list (no smooth scrolling: respects reduce motion).
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [i, items]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(!useUi.getState().paletteOpen); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [setPalette]);
  useEffect(() => { if (paletteOpen) { setQ(""); setI(0); } }, [paletteOpen]);
  const go = (e?: PaletteEntry) => {
    if (!e) return;
    // Opening a player (or a looked-up Riot ID) puts it at the top of the recent searches.
    if (e.kind === "player" || e.kind === "lookup") addRecent(e.riotId);
    nav(e.kind === "page" ? e.item.path : e.path); setPalette(false);
  };
  return (
    <AnimatePresence>
      {paletteOpen && (
        <motion.div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-start justify-center pt-[16vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setPalette(false)}>
          <motion.div role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: -12, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8, opacity: 0 }} transition={spring}
            className="glass rounded-xl w-[560px] overflow-hidden">
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder="Search pages, champions and players…"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setI((i + 1) % Math.max(items.length, 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setI((i - 1 + items.length) % Math.max(items.length, 1)); }
                if (e.key === "Enter" && e.shiftKey) { const p = items[i]; if (p && (p.kind === "player" || p.kind === "lookup")) toggleFavourite(p.riotId); }
                else if (e.key === "Enter") go(items[i]);
                if (e.key === "Tab") e.preventDefault(); // keep focus inside the dialog
              }}
              className="w-full h-12 px-4 bg-transparent outline-none border-b border-line/10 text-sm" />
            <ul ref={listRef} className="p-2 max-h-72 overflow-auto" role="listbox">
              {items.map((e, idx) => (
                <Fragment key={e.key}>
                  {(idx === 0 || items[idx - 1].group !== e.group) && (
                    <li role="presentation" className="px-3 pt-2 pb-1 text-[0.6875rem] uppercase tracking-wide text-muted">{e.group}</li>
                  )}
                  <li role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)} onClick={() => go(e)}
                    className={`flex items-center gap-3 h-10 px-3 rounded-md text-sm cursor-pointer ${idx === i ? "bg-accent/20" : ""}`}>
                    {e.kind === "page" ? <><e.item.icon size={16} className="text-muted" /> {e.item.label}</>
                      : e.kind === "champion" ? <><ChampIcon id={e.champion.id} name={e.champion.name} size={24} /> {e.champion.name}</>
                      : e.kind === "lookup" ? <><UserSearch size={16} className="text-accent" /> <span className="truncate">Look up {e.riotId}</span></>
                      : <><User size={16} className="text-muted" /> <span className="truncate">{e.riotId}</span></>}
                    {(e.kind === "player" || e.kind === "lookup") && (
                      <button type="button" tabIndex={-1} title={(e.kind === "player" && e.favourite ? "Remove from favourites" : "Add to favourites") + " (Shift+Enter)"}
                        aria-label={e.kind === "player" && e.favourite ? "Remove from favourites" : "Add to favourites"} aria-pressed={e.kind === "player" && e.favourite}
                        onClick={(ev) => { ev.stopPropagation(); toggleFavourite(e.riotId); }}
                        className="focus-ring ml-auto grid place-items-center w-7 h-7 rounded-md text-muted hover:text-text">
                        <Star size={14} className={e.kind === "player" && e.favourite ? "text-gold fill-current" : ""} />
                      </button>
                    )}
                  </li>
                </Fragment>
              ))}
              {!items.length && <li className="px-3 py-6 text-sm text-muted">Nothing matches “{q}”. For a player, type the full Name#TAG.</li>}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Shell() {
  const compact = useUi((s) => s.compact), nav = useNavigate(), active = useDraft((s) => s.draft.active), auto = useUi((s) => s.autoCompact);
  const autoOn = useRef(false); // true only if auto mode (not the user) entered compact
  useEffect(() => { if (compact) nav("/draft"); }, [compact, nav]);
  useEffect(() => {
    if (!auto) return;
    if (active && !useUi.getState().compact) { autoOn.current = true; void applyCompact(true); }
    else if (!active && autoOn.current) { autoOn.current = false; void applyCompact(false); }
  }, [active, auto]);
  useDdChampions(); // preload the full champion list
  const loc = useLocation(), mainRef = useRef<HTMLElement>(null);
  const label = [...NAV, SETTINGS_ITEM].find((n) => (n.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.path)))?.label ?? "Apex";
  useEffect(() => { document.title = `${label} · Apex`; mainRef.current?.scrollTo(0, 0); }, [label, loc.pathname]);
  useEffect(() => { // dev-only approximation of the 100 ms tab-switch budget
    if (!import.meta.env.DEV) return;
    // Browsers pause animation frames in background tabs, which would show a huge fake delay. Skip those samples.
    let tainted = document.hidden, raf = 0;
    const onVis = () => { tainted = true; };
    document.addEventListener("visibilitychange", onVis);
    const t0 = performance.now();
    raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => {
      const ms = performance.now() - t0;
      if (!tainted) (ms > 100 ? console.warn : console.info)(`[perf] ${loc.pathname} ~${ms.toFixed(0)} ms (budget 100)`);
    }); });
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", onVis); };
  }, [loc.pathname]);
  return (
    <div className="h-full flex flex-col">
      <button className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:top-2 focus:left-2 glass rounded-md px-3 py-2 text-sm" onClick={() => mainRef.current?.focus()}>Skip to content</button>
      <TitleBar />
      <div className="flex-1 flex min-h-0">
        {!compact && <Sidebar />}
        <main id="main" ref={mainRef} tabIndex={-1} className={`flex-1 min-w-0 outline-none overflow-y-auto ${compact ? "p-4" : "p-8"}`}>
          {/* Enter-only transition. An exit animation (AnimatePresence mode="wait") could get stuck at opacity 0
              when combined with lazy routes and rapid clicks, leaving a blank page. */}
          <motion.div key={loc.pathname} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16, ease: "easeOut" }}>
            <Suspense fallback={<div className="space-y-3"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}><Outlet /></Suspense>
          </motion.div>
        </main>
      </div>
      {!compact && <StatusArea />}
      <div className="sr-only" role="status" aria-live="polite">{label}</div>
      <CommandPalette />
      <Toaster />
    </div>
  );
}

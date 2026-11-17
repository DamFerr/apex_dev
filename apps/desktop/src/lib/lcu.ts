import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { champIndex } from "./ddragon";
import type { Role } from "@apex/schema";
import { fetchBuild, importItemSet, importRunes, importSpells } from "./importer";
import { isTauri } from "./tauri";
import { initialDraft, nextPick, parseLcuMessage, reduce, shouldImport, CHAMPION_KEYS, type DraftState, type LcuEvent, type OverlayPick } from "@apex/lcu-core";

/** Address of the local League client simulator (packages/lcu-mock). Only used by the browser dev preview, never in the desktop app. */
const DEV_LCU_HOST = "127.0.0.1:8765";
/** Prefers the full Data Dragon list; falls back to the small built-in table when offline. */
export const champId = (key: number): string | undefined => champIndex.get(key)?.id ?? CHAMPION_KEYS[key];
export const champName = (key: number) => champIndex.get(key)?.name ?? (CHAMPION_KEYS[key] ?? `Champion ${key}`).replace(/([a-z])([A-Z])/g, "$1 $2");

interface DraftStore {
  draft: DraftState; /** The champion you locked, kept through the loading screen and the game (the draft itself is reset when champ select ends). */ overlayPick: OverlayPick | null; autoImport: boolean; spells: boolean; setSpells: (v: boolean) => void; items: boolean; setItems: (v: boolean) => void; log: { id: number; text: string }[];
  setAutoImport: (v: boolean) => void; dispatch: (e: LcuEvent) => void;
}
const addLog = (text: string) => useDraft.setState((s) => ({ log: [{ id: Date.now() + Math.random(), text }, ...s.log].slice(0, 8) }));
/** Imports runes (and optionally summoner spells and an item set) and reports each outcome in the import log. */
export async function runImport(championKey: number, role: Role | null) {
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const build = await fetchBuild(championKey, role).catch(() => null); // null = use defaults, each step says which it used
  try { const r = await importRunes(championKey, build); addLog(`Imported rune page "${r.name}" (${r.source})`); }
  catch (e) { addLog(`Rune import failed: ${msg(e)}`); }
  if (useDraft.getState().spells) {
    try { const r = await importSpells(role, build); addLog(`Set summoner spells: ${r.text} (${r.source})`); }
    catch (e) { addLog(`Spell import failed: ${msg(e)}`); }
  }
  if (useDraft.getState().items) {
    try { const t = await importItemSet(championKey, build); addLog(t ? `Imported item set "${t}" (final items of ${build!.games} collected games${build!.startItems || build!.corePath ? ", plus starting items and build order from timelines" : ""})` : "Item set skipped: not enough collected games for this champion yet"); }
    catch (e) { addLog(`Item set import failed: ${msg(e)}`); }
  }
}
export const useDraft = create<DraftStore>((set, get) => ({
  draft: initialDraft, overlayPick: null, autoImport: false, spells: true, setSpells: (spells) => set({ spells }), items: true, setItems: (items) => set({ items }), log: [],
  setAutoImport: (autoImport) => set({ autoImport }),
  dispatch: (e) => {
    const prev = get().draft, next = reduce(prev, e), imp = shouldImport(prev, next, { autoImport: get().autoImport });
    set({ draft: next, overlayPick: nextPick(get().overlayPick, next) });
    if (!imp) return;
    if (isTauri) void runImport(imp.championId, imp.role);
    else addLog(`Import skipped for ${champName(imp.championId)}: writing to the League client needs the desktop app.`);
  },
}));

/** Browser dev preview only: connects to the local League client simulator and retries every 3 s. */
export function startDevLcu(): () => void {
  let ws: WebSocket | null = null, stopped = false, timer = 0;
  const open = () => {
    ws = new WebSocket(`ws://${DEV_LCU_HOST}`);
    ws.onopen = () => useDraft.getState().dispatch({ type: "connected" });
    ws.onmessage = (m) => { const ev = parseLcuMessage(String(m.data)); if (ev) useDraft.getState().dispatch(ev); };
    ws.onclose = () => { useDraft.getState().dispatch({ type: "disconnected" }); if (!stopped) timer = window.setTimeout(open, 3000); };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => { stopped = true; clearTimeout(timer); ws?.close(); };
}

/** Real transport: the Rust connector (src-tauri/src/lcu.rs) forwards raw LCU frames as Tauri events. */
export function startTauriLcu(): () => void {
  const off: (() => void)[] = []; let dead = false;
  const dispatch = (e: LcuEvent) => useDraft.getState().dispatch(e);
  const keep = (p: Promise<() => void>) => p.then((f) => { if (dead) f(); else off.push(f); });
  const l1 = keep(listen<string>("lcu-message", (e) => {
    if (!useDraft.getState().draft.connected) dispatch({ type: "connected" }); // a frame proves the client is there
    const ev = parseLcuMessage(e.payload); if (ev) dispatch(ev);
  }));
  const l2 = keep(listen<string>("lcu-status", (e) => dispatch({ type: e.payload === "connected" ? "connected" : "disconnected" })));
  // The Rust side may have connected before we were listening: ask it to re-send status and current state.
  Promise.all([l1, l2]).then(() => invoke<boolean>("lcu_sync")).then((ok) => { if (ok && !dead) dispatch({ type: "connected" }); }).catch(() => undefined);
  return () => { dead = true; off.forEach((f) => f()); dispatch({ type: "disconnected" }); };
}

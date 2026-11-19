import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MatchFilter, QueueFilter, StatsFilter } from "@apex/schema";
import type { FlashSlot, OverlayPlacement } from "@apex/lcu-core";
import { pushRecent, removeFromList, toggleFavourite } from "./recentFavs";

export type Theme = "dark" | "light" | "colorblind";
export type OverlayCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
/** A free overlay position on one monitor: logical pixels from that monitor's top-left (the monitor id is the key in `overlayPositions`). */
export type OverlayXY = Pick<OverlayPlacement, "x" | "y">;
/** Keeps only well-formed saved positions (finite numbers, non-empty monitor id), so a hand-edited or broken store never reaches the clamping function. */
export function cleanOverlayPositions(v: unknown): Record<string, OverlayXY> {
  const out: Record<string, OverlayXY> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [id, p] of Object.entries(v as Record<string, unknown>)) {
    const { x, y } = (p ?? {}) as Record<string, unknown>;
    if (id && typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) out[id] = { x: Math.round(x), y: Math.round(y) };
  }
  return out;
}
/** The saved spot of the overlay as `clampOverlayPosition` wants it: the last monitor it was placed on, or null (= use the corner preset). */
export function savedOverlayPlacement(s: { overlayMonitor: string | null; overlayPositions: Record<string, OverlayXY> }): OverlayPlacement | null {
  const p = s.overlayMonitor ? s.overlayPositions[s.overlayMonitor] : undefined;
  return s.overlayMonitor && p ? { monitorId: s.overlayMonitor, ...p } : null;
}
/**
 * Store migration. Version 1 removed the sample-data source, the demo Riot ID and the unfinished overlay/language/telemetry settings (only for stores older than 1:
 * later stores must keep their overlay settings). Version 2 added `overlayPositions` / `overlayMonitor`; older stores simply start without a free position.
 */
export function migrateUi(old: unknown, version: number): UiState {
  const s = { ...(old as Record<string, unknown>) };
  if (version < 1) {
    if (s.myRiotId === "Demo Player#EUW") s.myRiotId = "";
    for (const k of ["dataSource", "lcuSource", "overlayEnabled", "overlayOpacity", "language", "telemetry"]) delete s[k];
    if (s.hotkeys && typeof s.hotkeys === "object") { const { overlayToggle: _drop, ...rest } = s.hotkeys as Record<string, string>; s.hotkeys = rest; }
  }
  s.overlayPositions = cleanOverlayPositions(s.overlayPositions);
  if (typeof s.overlayMonitor !== "string" || !(s.overlayMonitor as string in (s.overlayPositions as object))) s.overlayMonitor = null;
  return s as unknown as UiState;
}
interface UiState {
  statsFilter: StatsFilter; /** Queue chip above the match lists (Profile and Home), remembered per device. */ queueFilter: QueueFilter; /** Champion / role chips above the match lists (shared by Profile and Home). Session only: a champion belongs to one player. */ matchFilter: MatchFilter; backendUrl: string; myRiotId: string;
  autoCompact: boolean; /** Open the Draft page when champ select starts (on by default; only moves around inside Apex). */ autoOpenDraft: boolean; /** Open the pick setup page when you lock in, from the Draft page only (on by default; only moves around inside Apex). */ autoOpenSetup: boolean; /** In-game overlay (off by default): shown only while a game runs. */ overlayEnabled: boolean; overlayOpacity: number; overlayCorner: OverlayCorner; /** Free overlay position per monitor id (set by "Move overlay"), and the monitor it was last placed on; null = use the corner preset. */ overlayPositions: Record<string, OverlayXY>; overlayMonitor: string | null; setOverlayPosition: (monitorId: string, xy: OverlayXY) => void; resetOverlayPosition: () => void; flashSlot: FlashSlot; /** Look up your own rank again after each game (default on; only your own Riot ID, through your local backend). */ autoRefreshRank: boolean; hotkeys: Record<string, string>; compact: boolean; patch: (p: Partial<UiState>) => void;
  theme: Theme; reduceMotion: boolean; paletteOpen: boolean; recent: string[]; addRecent: (id: string) => void; removeRecent: (id: string) => void; /** Favourite players (Riot IDs), local only, shown in the search bar. */ favourites: string[]; toggleFavourite: (id: string) => void;
  setTheme: (t: Theme) => void; setReduceMotion: (v: boolean) => void; setPalette: (v: boolean) => void;
}
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark", reduceMotion: false, paletteOpen: false, statsFilter: { platform: "all", patch: "latest", rank: "all" }, queueFilter: "all", matchFilter: {},
      backendUrl: "http://127.0.0.1:8787", myRiotId: "", patch: (p) => set(p),
      autoCompact: false, autoOpenDraft: true, autoOpenSetup: true, overlayEnabled: false, overlayOpacity: 0.9, overlayCorner: "top-left", overlayPositions: {}, overlayMonitor: null, flashSlot: "F", autoRefreshRank: true, compact: false, hotkeys: { compactToggle: "Ctrl+Shift+M" }, recent: [], favourites: [],
      addRecent: (id) => set((s) => ({ recent: pushRecent(s.recent, id) })),
      removeRecent: (id) => set((s) => ({ recent: removeFromList(s.recent, id) })),
      toggleFavourite: (id) => set((s) => ({ favourites: toggleFavourite(s.favourites, id) })),
      setOverlayPosition: (monitorId, xy) => set((s) => ({ overlayPositions: { ...s.overlayPositions, ...cleanOverlayPositions({ [monitorId]: xy }) }, overlayMonitor: monitorId })),
      resetOverlayPosition: () => set({ overlayPositions: {}, overlayMonitor: null }),
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: "apex-ui", version: 2,
      migrate: migrateUi,
      partialize: (s) => ({ theme: s.theme, reduceMotion: s.reduceMotion, recent: s.recent, favourites: s.favourites, statsFilter: s.statsFilter, queueFilter: s.queueFilter, backendUrl: s.backendUrl, myRiotId: s.myRiotId, autoCompact: s.autoCompact, autoOpenDraft: s.autoOpenDraft, autoOpenSetup: s.autoOpenSetup, overlayEnabled: s.overlayEnabled, overlayOpacity: s.overlayOpacity, overlayCorner: s.overlayCorner, overlayPositions: s.overlayPositions, overlayMonitor: s.overlayMonitor, flashSlot: s.flashSlot, autoRefreshRank: s.autoRefreshRank, hotkeys: s.hotkeys }),
    },
  ),
);

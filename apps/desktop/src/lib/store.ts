import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QueueFilter, StatsFilter } from "@apex/schema";
import type { FlashSlot } from "@apex/lcu-core";
import { pushRecent, removeFromList, toggleFavourite } from "./recentFavs";

export type Theme = "dark" | "light" | "colorblind";
export type OverlayCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
interface UiState {
  statsFilter: StatsFilter; /** Queue chip above the match lists (Profile and Home), remembered per device. */ queueFilter: QueueFilter; backendUrl: string; myRiotId: string;
  autoCompact: boolean; /** In-game overlay (off by default): shown only while a game runs. */ overlayEnabled: boolean; overlayOpacity: number; overlayCorner: OverlayCorner; flashSlot: FlashSlot; /** Look up your own rank again after each game (default on; only your own Riot ID, through your local backend). */ autoRefreshRank: boolean; hotkeys: Record<string, string>; compact: boolean; patch: (p: Partial<UiState>) => void;
  theme: Theme; reduceMotion: boolean; paletteOpen: boolean; recent: string[]; addRecent: (id: string) => void; removeRecent: (id: string) => void; /** Favourite players (Riot IDs), local only, shown in the search bar. */ favourites: string[]; toggleFavourite: (id: string) => void;
  setTheme: (t: Theme) => void; setReduceMotion: (v: boolean) => void; setPalette: (v: boolean) => void;
}
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark", reduceMotion: false, paletteOpen: false, statsFilter: { platform: "all", patch: "latest", rank: "all" }, queueFilter: "all",
      backendUrl: "http://127.0.0.1:8787", myRiotId: "", patch: (p) => set(p),
      autoCompact: false, overlayEnabled: false, overlayOpacity: 0.9, overlayCorner: "top-left", flashSlot: "F", autoRefreshRank: true, compact: false, hotkeys: { compactToggle: "Ctrl+Shift+M" }, recent: [], favourites: [],
      addRecent: (id) => set((s) => ({ recent: pushRecent(s.recent, id) })),
      removeRecent: (id) => set((s) => ({ recent: removeFromList(s.recent, id) })),
      toggleFavourite: (id) => set((s) => ({ favourites: toggleFavourite(s.favourites, id) })),
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
    }),
    {
      name: "apex-ui", version: 1,
      // Version 1 removed the sample-data source, the demo Riot ID, and the unfinished overlay/language/telemetry settings.
      migrate: (old) => {
        const s = { ...(old as Record<string, unknown>) };
        if (s.myRiotId === "Demo Player#EUW") s.myRiotId = "";
        for (const k of ["dataSource", "lcuSource", "overlayEnabled", "overlayOpacity", "language", "telemetry"]) delete s[k];
        if (s.hotkeys && typeof s.hotkeys === "object") { const { overlayToggle: _drop, ...rest } = s.hotkeys as Record<string, string>; s.hotkeys = rest; }
        return s as unknown as UiState;
      },
      partialize: (s) => ({ theme: s.theme, reduceMotion: s.reduceMotion, recent: s.recent, favourites: s.favourites, statsFilter: s.statsFilter, queueFilter: s.queueFilter, backendUrl: s.backendUrl, myRiotId: s.myRiotId, autoCompact: s.autoCompact, overlayEnabled: s.overlayEnabled, overlayOpacity: s.overlayOpacity, overlayCorner: s.overlayCorner, flashSlot: s.flashSlot, autoRefreshRank: s.autoRefreshRank, hotkeys: s.hotkeys }),
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { StatsFilter } from "@apex/schema";
export type LcuSource = "mock" | "real";
export type Theme = "dark" | "light" | "colorblind";
interface UiState {
  statsFilter: StatsFilter;
  backendUrl: string; myRiotId: string;
  overlayEnabled: boolean; overlayOpacity: number; language: string; telemetry: boolean; autoCompact: boolean;
  hotkeys: Record<string, string>; compact: boolean; patch: (p: Partial<UiState>) => void;
  theme: Theme; reduceMotion: boolean; paletteOpen: boolean; lcuSource: LcuSource; setLcuSource: (s: LcuSource) => void; recent: string[]; addRecent: (id: string) => void;
  setTheme: (t: Theme) => void; setReduceMotion: (v: boolean) => void; setPalette: (v: boolean) => void;
}
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark", reduceMotion: false, paletteOpen: false, statsFilter: { platform: "all", patch: "latest", rank: "all" }, backendUrl: "http://127.0.0.1:8787", myRiotId: "", patch: (p) => set(p),
      overlayEnabled: false, overlayOpacity: 0.9, language: "en", telemetry: false, autoCompact: false, compact: false,
      hotkeys: { overlayToggle: "Ctrl+Shift+O", compactToggle: "Ctrl+Shift+M" }, lcuSource: import.meta.env.DEV ? "mock" : "real",
      setLcuSource: (lcuSource) => set({ lcuSource }), recent: [],
      addRecent: (id) => set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 5) })),
      setTheme: (theme) => set({ theme }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setPalette: (paletteOpen) => set({ paletteOpen }),
    }),
    { name: "apex-ui", version: 1,
      // v0 had a mock/backend switch and a demo Riot ID. Both are gone: drop them from saved settings.
      migrate: (old) => { const o = { ...(old as Record<string, unknown>) }; delete o.dataSource; if (o.myRiotId === "Demo Player#EUW") o.myRiotId = ""; return o as never; },
      partialize: (s) => ({ theme: s.theme, reduceMotion: s.reduceMotion, recent: s.recent, lcuSource: s.lcuSource, statsFilter: s.statsFilter, backendUrl: s.backendUrl, myRiotId: s.myRiotId, overlayEnabled: s.overlayEnabled, overlayOpacity: s.overlayOpacity, language: s.language, telemetry: s.telemetry, autoCompact: s.autoCompact, hotkeys: s.hotkeys }) },
  ),
);

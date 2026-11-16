import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StatsFilter } from "@apex/schema";
import type { FlashSlot } from "@apex/lcu-core";

export type Theme = "dark" | "light" | "colorblind";
interface UiState {
  statsFilter: StatsFilter; backendUrl: string; myRiotId: string;
  autoCompact: boolean; flashSlot: FlashSlot; hotkeys: Record<string, string>; compact: boolean; patch: (p: Partial<UiState>) => void;
  theme: Theme; reduceMotion: boolean; paletteOpen: boolean; recent: string[]; addRecent: (id: string) => void;
  setTheme: (t: Theme) => void; setReduceMotion: (v: boolean) => void; setPalette: (v: boolean) => void;
}
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "dark", reduceMotion: false, paletteOpen: false, statsFilter: { platform: "all", patch: "latest", rank: "all" },
      backendUrl: "http://127.0.0.1:8787", myRiotId: "", patch: (p) => set(p),
      autoCompact: false, flashSlot: "F", compact: false, hotkeys: { compactToggle: "Ctrl+Shift+M" }, recent: [],
      addRecent: (id) => set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 5) })),
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
      partialize: (s) => ({ theme: s.theme, reduceMotion: s.reduceMotion, recent: s.recent, statsFilter: s.statsFilter, backendUrl: s.backendUrl, myRiotId: s.myRiotId, autoCompact: s.autoCompact, flashSlot: s.flashSlot, hotkeys: s.hotkeys }),
    },
  ),
);

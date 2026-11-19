import { MotionConfig } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useUi } from "../lib/store";
import { Champions, ChampionPage, Draft, Profile, Settings, TierList, LiveGame, Recap, PickSetupPage } from "./lazyPages";
import { Home } from "./Home";
import { startDevLcu, startTauriLcu } from "../lib/lcu";
import { isTauri } from "../lib/tauri";
import { applyCompact, ensureNormalSize } from "../lib/compact";
import { combo } from "../lib/hotkeys";
import { useOverlayController } from "../lib/overlay";
import { useRankRefresh } from "../lib/rankRefresh";
import { Shell } from "./Shell";

export const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function App() {
  const { theme, reduceMotion } = useUi();
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduceMotion); }, [reduceMotion]);
  useEffect(() => (isTauri ? startTauriLcu() : import.meta.env.DEV ? startDevLcu() : undefined), []);
  useOverlayController();
  useRankRefresh(qc);
  useEffect(() => { void ensureNormalSize(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const c = combo(e), { hotkeys, compact } = useUi.getState();
      if (c && c === hotkeys.compactToggle) { e.preventDefault(); void applyCompact(!compact); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="profile/:riotId?" element={<Profile />} />
              <Route path="champions" element={<Champions />} />
              <Route path="champions/:id" element={<ChampionPage />} />
              <Route path="tierlist" element={<TierList />} />
              <Route path="live/:riotId?" element={<LiveGame />} />
              <Route path="recap/:riotId?/:matchId?" element={<Recap />} />
              <Route path="draft" element={<Draft />} />
              <Route path="draft/setup/:id/:role?" element={<PickSetupPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}

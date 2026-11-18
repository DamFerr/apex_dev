import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gameEnded, isInGame } from "@apex/lcu-core";
import type { PostGameRecap } from "@apex/schema";
import { Button, spring } from "../components/ui";
import { api } from "../lib/api";
import { useDraft } from "../lib/lcu";
import { useUi } from "../lib/store";
import { RecapView } from "./Recap";

const FIRST_TRY_MS = 15_000, RETRY_MS = 20_000, GIVE_UP_MS = 8 * 60_000;

/**
 * Pops the recap of your game up when it ends. The League client's game phase says when a game ended (`gameEnded`), but Riot's match API
 * lists the game a little later, so Apex asks again every 20 s (first try after 15 s) until a game that is new compared with the one
 * that was latest when this game started shows up, and only then opens the popup. Games Riot never lists (custom, practice tool,
 * remakes) therefore open nothing. Gives up after 8 minutes. Only your own Riot ID is looked up, through your local backend.
 */
export function GameSummary() {
  const phase = useDraft((s) => s.draft.gameflow), prev = useRef(phase);
  const base = useRef<{ id: string | null; since: number } | null>(null);   // latest game before this one, and when it started
  const token = useRef(0), timer = useRef<ReturnType<typeof setTimeout>>();
  const [recap, setRecap] = useState<{ r: PostGameRecap; id: string } | null>(null), nav = useNavigate();
  useEffect(() => {
    const before = prev.current; prev.current = phase;
    const id = useUi.getState().myRiotId;
    if (isInGame(phase)) {                                                  // a game runs: remember which game is the latest right now
      if (!base.current && id) { const b = { id: null as string | null, since: Date.now() }; base.current = b; api.getRecap(id).then((x) => { b.id = x.matchId; }).catch(() => undefined); }
      return;
    }
    const b = base.current; base.current = null;
    if (!b || !id || !gameEnded(before, phase)) return;
    const mine = ++token.current, t0 = Date.now();
    const poll = async () => {
      if (token.current !== mine) return;
      try {
        const x = await api.getRecap(id);
        // New = another game than the one before; if that one was unknown, a game played since this one started.
        if (b.id ? x.matchId !== b.id : Date.parse(x.playedAt) >= b.since - 60_000) { if (token.current === mine) setRecap({ r: x, id }); return; }
      } catch { /* Riot not ready or unreachable: try again */ }
      if (Date.now() - t0 < GIVE_UP_MS) timer.current = setTimeout(() => void poll(), RETRY_MS);
    };
    clearTimeout(timer.current); timer.current = setTimeout(() => void poll(), FIRST_TRY_MS);
  }, [phase]);
  useEffect(() => () => { token.current++; clearTimeout(timer.current); }, []);
  const close = () => setRecap(null);
  useEffect(() => {
    if (!recap) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [recap]);
  return (
    <AnimatePresence>
      {recap && (
        <motion.div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm grid place-items-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={close}>
          <motion.div role="dialog" aria-modal="true" aria-label="Game summary" onMouseDown={(e) => e.stopPropagation()}
            initial={{ y: 12, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 8, opacity: 0 }} transition={spring}
            className="glass rounded-xl w-[min(1000px,100%)] max-h-full overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl font-semibold">Game summary</h2>
              <button autoFocus aria-label="Close game summary" onClick={close} className="focus-ring rounded-md p-2 text-muted hover:text-text"><X size={18} /></button>
            </div>
            <RecapView r={recap.r} id={recap.id} inDialog />
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={close}>Close</Button>
              <Button onClick={() => { nav(`/recap/${encodeURIComponent(recap.id)}/${encodeURIComponent(recap.r.matchId)}`); close(); }}>Open full recap</Button>
            </div>
          </motion.div>
        </motion.div>)}
    </AnimatePresence>);
}

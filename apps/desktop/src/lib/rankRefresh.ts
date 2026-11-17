import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { gameEnded, RANK_REFRESH_DELAYS_MS } from "@apex/lcu-core";
import { api } from "./api";
import { useDraft } from "./lcu";
import { useUi } from "./store";

/**
 * Looks up YOUR rank again after each game, so Home, Profile and the LP history are up to date without opening them.
 * Triggered by the League client's game phase (a running game ends, see `gameEnded`); asks twice, soon and later, because Riot's API
 * shows the new rank a little after the game. Only your own Riot ID is looked up, through your local backend (a lookup also records a
 * rank snapshot there when the rank changed). Does nothing without a Riot ID or when switched off in Settings. Takes no part in the game.
 * `qc` is passed in because App provides the QueryClient to its children, not to itself.
 */
export function useRankRefresh(qc: QueryClient) {
  const phase = useDraft((s) => s.draft.gameflow), before = useRef(phase), timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const prev = before.current; before.current = phase;
    const { autoRefreshRank, myRiotId } = useUi.getState();
    if (!autoRefreshRank || !myRiotId || !gameEnded(prev, phase)) return;
    timers.current.forEach(clearTimeout);                       // a new game ended: restart, never stack lookups
    timers.current = RANK_REFRESH_DELAYS_MS.map((ms) => setTimeout(() => {
      const id = useUi.getState().myRiotId; if (!id) return;
      void api.getRankHistory(id, { fresh: true })
        .then(() => qc.invalidateQueries({ predicate: (q) => (q.queryKey[1] === "summoner" || q.queryKey[1] === "lphistory") && q.queryKey[2] === id }))
        .catch(() => undefined);                                 // Riot unreachable: the next try or the next time you open a screen will do
    }, ms));
  }, [phase, qc]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
}

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ApexApi, QueueFilter, Role } from "@apex/schema";
import { createHttpApi } from "./http";
import { useUi } from "../store";
import { normalizeSearch } from "../searchMatch";
import { fetchStoredPlayers } from "./storedPlayers";

/** Screens only ever use this. It always talks to the local backend (services/api). */
export const api: ApexApi = createHttpApi(() => useUi.getState().backendUrl);

/** Part of every query key, so results from a different backend address are never reused. */
export const useScope = () => useUi((s) => s.backendUrl);
const useFilter = () => useUi((s) => s.statsFilter);

export const useSummoner = (id: string) => useQuery({ queryKey: [useScope(), "summoner", id], queryFn: () => api.getSummoner(id), enabled: !!id });
export const useMatches = (id: string, limit = 10, queue: QueueFilter = "all") =>
  useQuery({ queryKey: [useScope(), "matches", id, limit, queue], queryFn: () => api.getRecentMatches(id, limit, queue), enabled: !!id });
export const useChampions = (role?: Role) => { const f = useFilter(); return useQuery({ queryKey: [useScope(), "champions", role ?? "all", f], queryFn: () => api.getChampions(role, f) }); };
export const useChampion = (id: string) => { const f = useFilter(); return useQuery({ queryKey: [useScope(), "champion", id, f], queryFn: () => api.getChampion(id, f) }); };
export const useChampionBuild = (id: string, role?: Role) => { const f = useFilter(); return useQuery({ queryKey: [useScope(), "build", id, role ?? "any", f], queryFn: () => api.getChampionBuild(id, role, f) }); };
export const useChampionRelations = (id: string, role?: Role) => { const f = useFilter(); return useQuery({ queryKey: [useScope(), "relations", id, role ?? "any", f], queryFn: () => api.getChampionRelations(id, role, f) }); };
/** Patch comparisons ignore the patch filter, so it is left out of the key: changing it must not refetch. */
const useRegionRank = () => useUi((s) => s.statsFilter.platform + "|" + s.statsFilter.rank);
export const useChampionPatches = (id: string, role?: Role) => { const f = useUi((s) => s.statsFilter), k = useRegionRank(); return useQuery({ queryKey: [useScope(), "patches", id, role ?? "any", k], queryFn: () => api.getChampionPatches(id, role, f) }); };
export const usePatchTrends = (role: Role) => { const f = useUi((s) => s.statsFilter), k = useRegionRank(); return useQuery({ queryKey: [useScope(), "patchtrends", role, k], queryFn: () => api.getPatchTrends(role, f) }); };
export const useFilterOptions = () => useQuery({ queryKey: [useScope(), "filters"], queryFn: () => api.getFilterOptions(), staleTime: 10_000 });
export const useMastery = (id: string) => useQuery({ queryKey: [useScope(), "mastery", id], queryFn: () => api.getMastery(id), enabled: !!id });
export const useRankHistory = (id: string) => useQuery({ queryKey: [useScope(), "lphistory", id], queryFn: () => api.getRankHistory(id), enabled: !!id });
export const usePool = (id: string) => useQuery({ queryKey: [useScope(), "pool", id], queryFn: () => api.getChampionPool(id), enabled: !!id });
export const useDraftStats = () => { const f = useFilter(); return useQuery({ queryKey: [useScope(), "draftstats", f], queryFn: () => api.getDraftStats(f), staleTime: 60_000 }); };
/** Refreshes every 30 s while a game is running (the backend caches for 45 s, so this is cheap). retry is off so "not found" shows at once. */
export const useLiveGame = (id: string) => useQuery({ queryKey: [useScope(), "live", id], queryFn: () => api.getLiveGame(id), enabled: !!id, retry: false, staleTime: 15_000,
  refetchInterval: (q) => (q.state.data?.inGame ? 30_000 : false) });
export const useRecap = (id: string, matchId?: string) => useQuery({ queryKey: [useScope(), "recap", id, matchId ?? "latest"], queryFn: () => api.getRecap(id, matchId), enabled: !!id, retry: false, staleTime: 60_000 });

/**
 * Players the local backend already stored, matching the palette text (debounced 200 ms, only for 2+ meaningful characters).
 * The backend never calls Riot for this; if it is offline the list is simply empty. Always returns Riot IDs (strings).
 */
const NONE: string[] = [];
export function useStoredPlayers(text: string, enabled = true): string[] {
  const base = useScope(), [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(text.trim()), 200); return () => clearTimeout(t); }, [text]);
  // `live` follows the text at once (an emptied box clears the list immediately); the request itself waits for the debounce. While the
  // debounce is pending the previous answer stays, and the palette filters it again against the current text.
  const q = debounced, live = enabled && normalizeSearch(text).length >= 2, on = live && normalizeSearch(q).length >= 2;
  const { data } = useQuery({
    queryKey: [base, "stored-players", q], enabled: on, retry: false, staleTime: 30_000, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => fetchStoredPlayers(base, q, signal),
  });
  // Memoised: the palette recomputes its rows (and scrolls the highlighted one into view) whenever this array changes.
  return useMemo(() => (live && data ? data.map((p) => p.riotId) : NONE), [live, data]);
}

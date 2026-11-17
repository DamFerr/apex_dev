import { useQuery } from "@tanstack/react-query";
import type { ApexApi, QueueFilter, Role } from "@apex/schema";
import { createHttpApi } from "./http";
import { useUi } from "../store";

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

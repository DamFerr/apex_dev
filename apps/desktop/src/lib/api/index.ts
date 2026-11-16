import { useQuery } from "@tanstack/react-query";
import type { ApexApi, Role } from "@apex/schema";
import { createHttpApi } from "./http";
import { useUi } from "../store";

/** Screens only ever use this. It talks to the local backend (services/api), which holds the Riot key and the collected data. */
export const api: ApexApi = createHttpApi(() => useUi.getState().backendUrl);

/** Part of every query key, so changing the backend address never shows another backend's cached results. */
export const useScope = () => useUi((s) => s.backendUrl);
const useIdQuery = <T,>(kind: string, id: string, fn: () => Promise<T>, extra: unknown[] = []) =>
  useQuery({ queryKey: [useScope(), kind, id, ...extra], queryFn: fn, enabled: !!id });
/** An empty id (no Riot ID set yet) never queries; screens show a prompt instead. */
export const useSummoner = (id = "") => useIdQuery("summoner", id, () => api.getSummoner(id));
export const useMatches = (id = "", limit = 10) => useIdQuery("matches", id, () => api.getRecentMatches(id, limit), [limit]);

export const useChampions = (role?: Role) => { const f = useUi((s) => s.statsFilter); return useQuery({ queryKey: [useScope(), "champions", role ?? "all", f], queryFn: () => api.getChampions(role, f) }); };
export const useChampion = (id: string) => { const f = useUi((s) => s.statsFilter); return useQuery({ queryKey: [useScope(), "champion", id, f], queryFn: () => api.getChampion(id, f) }); };
export const useFilterOptions = () => useQuery({ queryKey: [useScope(), "filters"], queryFn: () => api.getFilterOptions(), staleTime: 10_000 });
export const useMastery = (id: string) => useIdQuery("mastery", id, () => api.getMastery(id));
export const useLpHistory = (id: string) => useIdQuery("lp", id, () => api.getLpHistory(id));
export const usePool = (id = "") => useIdQuery("pool", id, () => api.getChampionPool(id));
export const useDraftStats = () => { const f = useUi((s) => s.statsFilter); return useQuery({ queryKey: [useScope(), "draftstats", f], queryFn: () => api.getDraftStats(f), staleTime: 60_000 }); };
/** Refreshes every 30 s while a game is running (the backend caches for 45 s, so this is cheap). retry is off so "not found" shows at once. */
export const useLiveGame = (id: string) => useQuery({ queryKey: [useScope(), "live", id], queryFn: () => api.getLiveGame(id), enabled: !!id, retry: false, staleTime: 15_000,
  refetchInterval: (q) => (q.state.data?.inGame ? 30_000 : false) });
export const useRecap = (id: string, matchId?: string) => useQuery({ queryKey: [useScope(), "recap", id, matchId ?? "latest"], queryFn: () => api.getRecap(id, matchId), enabled: !!id, retry: false, staleTime: 60_000 });

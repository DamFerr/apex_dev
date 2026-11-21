import type { ApexApi, MatchFilter, MatchPage, MatchSummary } from "@apex/schema";

/** The backend serves at most 20 games per page; longer windows are read page by page (bounded, so a rarely played queue cannot loop for long). */
const PAGE_CAP = 20, MAX_PAGES = 6;

/**
 * Talks to your local Apex backend (services/api). The Riot API key lives only there, never in the app.
 */
export function createHttpApi(base: () => string): ApexApi {
  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const q = new URLSearchParams(params);
    let res: Response;
    try { res = await fetch(`${base()}${path}?${q}`); }
    catch { throw new Error(`Local backend not reachable at ${base()}. Start it with "pnpm api".`); }
    if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Backend error ${res.status}`);
    return (await res.json()) as T;
  }
  const filterParams = (f?: { platform: string; patch: string; rank: string }): Record<string, string> => (f ? { region: f.platform, patch: f.patch, rank: f.rank } : {});
  const player = (id: string) => `/v1/players/${encodeURIComponent(id)}`;
  const page = (id: string, cursor: number, limit: number, queue?: string, f?: MatchFilter) => get<MatchPage>(`${player(id)}/matches`, { cursor: String(cursor), limit: String(limit), ...(queue && queue !== "all" ? { queue } : {}), ...(f?.champion ? { champion: f.champion } : {}), ...(f?.role ? { role: f.role } : {}) });
  return {
    getSummoner: (id) => get(player(id)),
    getMatchPage: page,
    getRecentMatches: async (id, limit = 10, queue, f) => {
      const items: MatchSummary[] = []; let cursor = 0;
      for (let i = 0; i < MAX_PAGES && items.length < limit; i++) {
        const p = await page(id, cursor, Math.min(PAGE_CAP, limit - items.length), queue, f);
        items.push(...p.items);
        if (p.nextCursor === null) break;
        cursor = p.nextCursor;
      }
      return items.slice(0, limit);
    },
    getOverview: (id, limit = 50, queue) => get(`${player(id)}/overview`, { limit: String(limit), ...(queue && queue !== "all" ? { queue } : {}) }),
    getRadar: (id, queue, role) => get(`${player(id)}/radar`, { ...(queue && queue !== "all" ? { queue } : {}), ...(role ? { role } : {}) }),
    getCutoffs: (platform) => get(`/v1/ladder/${encodeURIComponent(platform)}/cutoffs`),
    getLadder: (platform, o = {}) => get(`/v1/ladder/${encodeURIComponent(platform)}`, { ...(o.queue ? { queue: o.queue } : {}), ...(o.tiers?.length ? { tier: o.tiers.join(",") } : {}), ...(o.offset ? { offset: String(o.offset) } : {}), ...(o.limit ? { limit: String(o.limit) } : {}) }),
    getLadderPlayer: (platform, puuid) => get(`/v1/ladder/${encodeURIComponent(platform)}/players/${encodeURIComponent(puuid)}`),
    getMatchDetail: (matchId, riotId) => get(`/v1/matches/${matchId}`, riotId ? { riotId } : {}),
    getMastery: (id) => get(`${player(id)}/mastery`),
    getRankHistory: (id, opts) => get(`${player(id)}/lp-history`, opts?.fresh ? { fresh: "1" } : {}),
    // Champion statistics come from the games the collector has stored (Settings > Data > Collector).
    getChampions: (role, f) => get("/v1/champions", { ...(role ? { role } : {}), ...filterParams(f) }),
    getChampion: (id, f) => get(`/v1/champions/${encodeURIComponent(id)}`, filterParams(f)),
    getChampionBuild: (id, role, f) => get(`/v1/champions/${encodeURIComponent(id)}/build`, { ...(role ? { role } : {}), ...filterParams(f) }),
    getChampionRelations: (id, role, f) => get(`/v1/champions/${encodeURIComponent(id)}/relations`, { ...(role ? { role } : {}), ...filterParams(f) }),
    // Patch comparisons span every kept patch, so the patch filter is not sent; region and rank are.
    getChampionLengths: (id, role, f) => get(`/v1/champions/${encodeURIComponent(id)}/lengths`, { ...(role ? { role } : {}), ...filterParams(f) }),
    getChampionPatches: (id, role, f) => get(`/v1/champions/${encodeURIComponent(id)}/patches`, { ...(role ? { role } : {}), ...(f ? { region: f.platform, rank: f.rank } : {}) }),
    getPatchTrends: (role, f) => get("/v1/patch-trends", { role, ...(f ? { region: f.platform, rank: f.rank } : {}) }),
    getFilterOptions: (f) => get("/v1/filters", filterParams(f)),
    getDraftStats: (f) => get("/v1/draft/data", filterParams(f)),
    getRecap: (id, matchId) => get(`${player(id)}/recap`, matchId ? { matchId } : {}),
    getLiveGame: (id) => get(`/v1/live/${encodeURIComponent(id)}`),
    getLiveRoleHistory: (id) => get(`/v1/live/${encodeURIComponent(id)}/roles`),
    getChampionPool: (id) => get(`${player(id)}/pool`),
  };
}

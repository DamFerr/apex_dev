import type { ApexApi, MatchPage } from "@apex/schema";

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
  const page = (id: string, cursor: number, limit: number) => get<MatchPage>(`${player(id)}/matches`, { cursor: String(cursor), limit: String(limit) });
  return {
    getSummoner: (id) => get(player(id)),
    getMatchPage: page,
    getRecentMatches: async (id, limit = 10) => (await page(id, 0, limit)).items,
    getMatchDetail: (matchId, riotId) => get(`/v1/matches/${matchId}`, riotId ? { riotId } : {}),
    getMastery: (id) => get(`${player(id)}/mastery`),
    // Champion statistics come from the games the collector has stored (Settings > Data > Collector).
    getChampions: (role, f) => get("/v1/champions", { ...(role ? { role } : {}), ...filterParams(f) }),
    getChampion: (id, f) => get(`/v1/champions/${encodeURIComponent(id)}`, filterParams(f)),
    getFilterOptions: () => get("/v1/filters"),
    getDraftStats: (f) => get("/v1/draft/data", filterParams(f)),
    getRecap: (id, matchId) => get(`${player(id)}/recap`, matchId ? { matchId } : {}),
    getLiveGame: (id) => get(`/v1/live/${encodeURIComponent(id)}`),
    getChampionPool: (id) => get(`${player(id)}/pool`),
  };
}

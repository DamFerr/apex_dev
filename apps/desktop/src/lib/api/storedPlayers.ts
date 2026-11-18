/** A player the local backend has already looked up (mirrors `StoredPlayer` in services/api/src/players.ts). */
export interface StoredPlayer { riotId: string; seenAt: number }

/**
 * Asks the local backend which already-stored players match the text (GET /v1/players?q=). The backend answers from its own database and
 * never calls Riot. This is a convenience for the search palette, so it never throws: backend offline, an error status or a strange answer
 * all give [] and the palette just shows its other groups.
 */
export async function fetchStoredPlayers(base: string, q: string, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<StoredPlayer[]> {
  try {
    const res = await fetchImpl(`${base}/v1/players?${new URLSearchParams({ q, limit: "8" })}`, { signal });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter((p): p is StoredPlayer => !!p && typeof p.riotId === "string" && p.riotId.length > 0 && typeof p.seenAt === "number");
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e; // lets react-query drop a cancelled request
    return [];
  }
}

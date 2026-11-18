import type { CacheRow } from "./db";

/** Cache key prefix of resolved Riot IDs (see `identity` in app.ts: `acct:<name>#<tag>`, lower case). */
export const ACCOUNT_PREFIX = "acct:";
/** A player this backend has already looked up (so it is stored locally); `seenAt` is when that lookup was last fetched from Riot. */
export interface StoredPlayer { riotId: string; seenAt: number }

/** Same rule as the desktop search (`lib/searchMatch.ts`): lower case, no accents, letters and digits only. */
export const normalizeName = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Players already stored by this backend whose Riot ID contains the text (case, space and punctuation-insensitive), newest first.
 * Works on rows read from the local cache only: Riot has no name-prefix search and nothing here calls Riot.
 * Fewer than 2 meaningful characters returns [] (a single letter would list everything). Damaged rows are skipped.
 */
export function searchStoredPlayers(rows: readonly CacheRow[], query: string, limit = 8): StoredPlayer[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const out: StoredPlayer[] = [], seen = new Set<string>(), max = Math.max(0, limit);
  if (max === 0) return out;
  for (const row of [...rows].sort((a, b) => b.at - a.at)) {
    let v: { gameName?: unknown; tagLine?: unknown };
    try { v = JSON.parse(row.value); } catch { continue; }
    if (typeof v?.gameName !== "string" || typeof v?.tagLine !== "string" || !v.gameName || !v.tagLine) continue;
    const riotId = `${v.gameName}#${v.tagLine}`, k = riotId.toLowerCase();
    if (seen.has(k) || !normalizeName(riotId).includes(q)) continue;
    seen.add(k); out.push({ riotId, seenAt: row.at });
    if (out.length >= max) break;
  }
  return out;
}

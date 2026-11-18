/**
 * Pure champion search matching for the unified search bar (PLAN.md C.1).
 * Case, space, punctuation and accent-insensitive: "kaisa" finds Kai'Sa, "wukong" finds MonkeyKing,
 * "drmundo" finds Dr. Mundo, "nunu" finds Nunu & Willump. No UI, no I/O, so it is trivial to test.
 */

/** The only fields the matcher needs; a Data Dragon champion satisfies it. */
export interface Searchable { id: string; name: string }

/** Lower-case, strip accents, then keep letters and digits only ("Kai'Sa" -> "kaisa", "Nunu & Willump" -> "nunuwillump"). */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Normalised words of a display name ("Nunu & Willump" -> ["nunu", "willump"]), used for word-start matches. */
function words(s: string): string[] {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Match quality, lower is better; null when it does not match.
 * 0 exact, 1 prefix of name or id, 2 prefix of a later word of the name ("willump"), 3 anywhere inside ("ais" finds Kai'Sa).
 */
export function matchRank(query: string, c: Searchable): number | null {
  const q = normalizeSearch(query);
  if (!q) return null;
  const name = normalizeSearch(c.name), id = normalizeSearch(c.id);
  if (name === q || id === q) return 0;
  if (name.startsWith(q) || id.startsWith(q)) return 1;
  if (words(c.name).some((w) => w.startsWith(q))) return 2;
  if (name.includes(q) || id.includes(q)) return 3;
  return null;
}

/**
 * Champions matching the query, best match first, ties alphabetical by display name.
 * An empty (or punctuation-only) query returns [], so the palette can show its default groups instead.
 */
export function searchChampions<T extends Searchable>(list: readonly T[], query: string, limit = 8): T[] {
  const ranked: { c: T; r: number }[] = [];
  for (const c of list) {
    const r = matchRank(query, c);
    if (r !== null) ranked.push({ c, r });
  }
  ranked.sort((a, b) => a.r - b.r || a.c.name.localeCompare(b.c.name, "en"));
  return ranked.slice(0, Math.max(0, limit)).map((x) => x.c);
}

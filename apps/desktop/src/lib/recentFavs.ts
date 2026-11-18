/**
 * Pure list helpers behind recent searches and favourite players (PLAN.md C.2).
 * Riot IDs are case-insensitive ("faker#kr1" is "Faker#KR1"), so lists compare case-insensitively
 * but keep the spelling the person typed last. Every helper returns a new array.
 */

export const RECENT_CAP = 5;
export const FAVOURITE_CAP = 50;

const key = (id: string) => id.trim().toLowerCase();

/** Put an id first, drop any earlier copy (any casing), keep at most `cap`. Blank ids are ignored. */
export function pushRecent(list: readonly string[], id: string, cap = RECENT_CAP): string[] {
  const v = id.trim();
  if (!v) return [...list];
  return [v, ...list.filter((r) => key(r) !== key(v))].slice(0, Math.max(0, cap));
}

/** Remove one id (any casing). */
export function removeFromList(list: readonly string[], id: string): string[] {
  return list.filter((r) => key(r) !== key(id));
}

export function isFavourite(list: readonly string[], id: string): boolean {
  return list.some((r) => key(r) === key(id));
}

/** Add an id at the front when missing, remove it when present. At the cap the oldest favourite is dropped. */
export function toggleFavourite(list: readonly string[], id: string, cap = FAVOURITE_CAP): string[] {
  const v = id.trim();
  if (!v) return [...list];
  if (isFavourite(list, v)) return removeFromList(list, v);
  return [v, ...list].slice(0, Math.max(0, cap));
}

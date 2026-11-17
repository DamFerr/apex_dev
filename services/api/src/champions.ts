/**
 * Champion ids in Apex are Data Dragon ids (the spelling used for icon files, names and splash art). Riot's Match-v5 `championName`
 * spells a few of them differently, so every id that comes from a match goes through `canonicalChampionId` before it is stored or shown.
 * Key = Riot's spelling, value = Data Dragon's. Add a line here if another champion shows a wrong name or a missing icon.
 */
export const RIOT_CHAMPION_ALIASES: Readonly<Record<string, string>> = { FiddleSticks: "Fiddlesticks" };

export const canonicalChampionId = (id: string): string => RIOT_CHAMPION_ALIASES[id] ?? id;

/** Finds the Data Dragon id that matches `id` ignoring upper/lower case, or returns `id` unchanged (a safety net for spellings not in the table). */
export function resolveChampionId(id: string, ddIds: Iterable<string>): string {
  const wanted = canonicalChampionId(id).toLowerCase();
  for (const d of ddIds) if (d.toLowerCase() === wanted) return d;
  return canonicalChampionId(id);
}

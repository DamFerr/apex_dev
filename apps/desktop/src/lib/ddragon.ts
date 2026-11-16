import { useQuery } from "@tanstack/react-query";
/**
 * Data Dragon assets are loaded from Riot's CDN at runtime and never redistributed or bundled
 * (plan section 12, rule 6). If the CDN is unreachable the UI falls back to initials.
 */
const BASE = "https://ddragon.leagueoflegends.com";
export const useDdVersion = () => useQuery({
  queryKey: ["ddragon-version"], staleTime: Infinity, retry: 1,
  queryFn: async () => { const r = await fetch(`${BASE}/api/versions.json`); if (!r.ok) throw new Error("Data Dragon unavailable"); return (await r.json())[0] as string; },
});
export const iconUrl = (v: string, id: string) => `${BASE}/cdn/${v}/img/champion/${id}.png`;
export const splashUrl = (id: string) => `${BASE}/cdn/img/champion/splash/${id}_0.jpg`;

export const itemIconUrl = (v: string, id: number) => `${BASE}/cdn/${v}/img/item/${id}.png`;
/** Rune and tree icons come with a path ("perk-images/Styles/...") in runesReforged.json. */
export const runeIconUrl = (icon: string) => `${BASE}/cdn/img/${icon}`;

export interface DdChampion { id: string; key: number; name: string; tags: string[] }
/** Numeric LCU champion key to champion. Filled from Data Dragon at runtime, so every champion is known. */
export const champIndex = new Map<number, DdChampion>();
let cache: Promise<DdChampion[]> | null = null;
export function fetchDdChampions(): Promise<DdChampion[]> {
  cache ??= (async () => {
    const vs = await fetch(`${BASE}/api/versions.json`); if (!vs.ok) throw new Error("Data Dragon unavailable");
    const v = (await vs.json())[0] as string;
    const r = await fetch(`${BASE}/cdn/${v}/data/en_US/champion.json`); if (!r.ok) throw new Error("Data Dragon unavailable");
    const data = (await r.json()).data as Record<string, { id: string; key: string; name: string; tags: string[] }>;
    const list = Object.values(data).map((c) => ({ id: c.id, key: Number(c.key), name: c.name, tags: c.tags }));
    list.forEach((c) => champIndex.set(c.key, c));
    return list;
  })().catch((e) => { cache = null; throw e; });
  return cache;
}
export const useDdChampions = () => useQuery({ queryKey: ["ddragon-champions"], queryFn: fetchDdChampions, staleTime: Infinity, retry: 1 });

import type { RuneStyle } from "@apex/lcu-core";
let runeCache: Promise<RuneStyle[]> | null = null;
export function fetchRunes(): Promise<RuneStyle[]> {
  runeCache ??= (async () => {
    const vs = await fetch(`${BASE}/api/versions.json`); if (!vs.ok) throw new Error("Data Dragon unavailable");
    const v = (await vs.json())[0] as string;
    const r = await fetch(`${BASE}/cdn/${v}/data/en_US/runesReforged.json`); if (!r.ok) throw new Error("Data Dragon unavailable");
    return (await r.json()) as RuneStyle[];
  })().catch((e) => { runeCache = null; throw e; });
  return runeCache;
}

/**
 * Display name for a champion id from the backend or Riot ("MonkeyKing" -> "Wukong", "DrMundo" -> "Dr. Mundo", "Velkoz" -> "Vel'Koz").
 * Names come from Data Dragon; until they load (or offline) the id is shown as is.
 */
export function useChampName(): (id: string) => string {
  const list = useDdChampions().data;
  if (!list) return (id) => id;
  const byId = new Map(list.map((c) => [c.id, c.name]));
  return (id) => byId.get(id) ?? id;
}

export const useRunes = () => useQuery({ queryKey: ["ddragon-runes"], queryFn: fetchRunes, staleTime: Infinity, retry: 1 });

import { useMemo } from "react";
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

import { parseSummonerSpells, type RuneStyle, type SpellIcon } from "@apex/lcu-core";
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

/** Summoner spell icon file (summoner.json `image.full`) and champion ability icon files (spell images, or passive images for the passive). */
export const spellIconUrl = (v: string, image: string) => `${BASE}/cdn/${v}/img/spell/${image}`;
export const passiveIconUrl = (v: string, image: string) => `${BASE}/cdn/${v}/img/passive/${image}`;

/** Numeric spell id (as the League client uses it) to name and icon file, from Data Dragon's summoner.json. */
export const useSummonerSpells = () => useQuery({
  queryKey: ["ddragon-summoner"], staleTime: Infinity, retry: 1,
  queryFn: async (): Promise<Map<number, SpellIcon>> => {
    const vs = await fetch(`${BASE}/api/versions.json`); if (!vs.ok) throw new Error("Data Dragon unavailable");
    const v = (await vs.json())[0] as string;
    const r = await fetch(`${BASE}/cdn/${v}/data/en_US/summoner.json`); if (!r.ok) throw new Error("Data Dragon unavailable");
    return parseSummonerSpells(await r.json());
  },
});

export type AbilitySlot = "P" | "Q" | "W" | "E" | "R";
export interface AbilityIcon { name: string; image: string; passive: boolean }
/** The five abilities of one champion (passive + QWER) from its Data Dragon champion file. Loaded per champion, only when an ability icon is shown. */
export const useChampionAbilities = (champion: string, enabled = true) => useQuery({
  queryKey: ["ddragon-abilities", champion], staleTime: Infinity, retry: 1, enabled,
  queryFn: async (): Promise<Record<AbilitySlot, AbilityIcon>> => {
    const vs = await fetch(`${BASE}/api/versions.json`); if (!vs.ok) throw new Error("Data Dragon unavailable");
    const v = (await vs.json())[0] as string;
    const r = await fetch(`${BASE}/cdn/${v}/data/en_US/champion/${encodeURIComponent(champion)}.json`); if (!r.ok) throw new Error("Data Dragon unavailable");
    const c = (await r.json()).data?.[champion] as { passive: { name: string; image: { full: string } }; spells: { name: string; image: { full: string } }[] } | undefined;
    if (!c || c.spells?.length < 4) throw new Error("Champion data incomplete");
    const sp = (i: number): AbilityIcon => ({ name: c.spells[i].name, image: c.spells[i].image.full, passive: false });
    return { P: { name: c.passive.name, image: c.passive.image.full, passive: true }, Q: sp(0), W: sp(1), E: sp(2), R: sp(3) };
  },
});

/** Item id to name, from Data Dragon's item.json (used where the backend sends only ids, like the match scoreboard). */
export const useItemNames = () => useQuery({
  queryKey: ["ddragon-items"], staleTime: Infinity, retry: 1,
  queryFn: async (): Promise<Map<number, string>> => {
    const vs = await fetch(`${BASE}/api/versions.json`); if (!vs.ok) throw new Error("Data Dragon unavailable");
    const v = (await vs.json())[0] as string;
    const r = await fetch(`${BASE}/cdn/${v}/data/en_US/item.json`); if (!r.ok) throw new Error("Data Dragon unavailable");
    const data = (await r.json()).data as Record<string, { name: string }>;
    return new Map(Object.entries(data).map(([id, i]) => [Number(id), i.name] as const));
  },
});

/** Rune or tree id to name and icon path, from runesReforged.json (trees included). Empty until loaded. */
export function useRuneLookup(): Map<number, { name: string; icon?: string }> {
  const styles = useRunes().data;
  return useMemo(() => {
    const m = new Map<number, { name: string; icon?: string }>();
    for (const st of styles ?? []) { m.set(st.id, { name: st.name, icon: st.icon }); for (const sl of st.slots) for (const r of sl.runes) m.set(r.id, { name: r.name, icon: r.icon }); }
    return m;
  }, [styles]);
}

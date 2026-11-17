/** Static game data from Data Dragon, loaded once per run. */
export type Champs = Map<number, { id: string; name: string; tags?: string[] }>;
/** Data Dragon id of the base Boots item. Every tier 2 and tier 3 boots is built from it, so this catches boots whose tags are missing or changed. */
const BASE_BOOTS = "1001";
export interface DD { champs: Champs; items: Map<number, { name: string; total: number; hasUpgrade: boolean; boots?: boolean; tags?: string[] }>; runes: Map<number, string> }

export function ddLoader(fetchFn: typeof fetch = fetch): () => Promise<DD> {
  let p: Promise<DD> | null = null;
  const json = async <T>(url: string) => { const r = await fetchFn(url); if (!r.ok) throw new Error(`Data Dragon ${r.status}`); return (await r.json()) as T; };
  return () => (p ??= (async () => {
    const base = "https://ddragon.leagueoflegends.com", v = (await json<string[]>(`${base}/api/versions.json`))[0];
    const [ch, it, ru] = await Promise.all([
      json<{ data: Record<string, { id: string; key: string; name: string; tags: string[] }> }>(`${base}/cdn/${v}/data/en_US/champion.json`),
      json<{ data: Record<string, { name: string; gold: { total: number }; into?: string[]; from?: string[]; tags?: string[] }> }>(`${base}/cdn/${v}/data/en_US/item.json`),
      json<{ slots: { runes: { id: number; name: string }[] }[] }[]>(`${base}/cdn/${v}/data/en_US/runesReforged.json`),
    ]);
    return {
      champs: new Map(Object.values(ch.data).map((c) => [Number(c.key), { id: c.id, name: c.name, tags: c.tags }] as const)),
      items: new Map(Object.entries(it.data).map(([id, i]) => [Number(id), { name: i.name, total: i.gold.total, hasUpgrade: !!i.into?.length, boots: !!i.tags?.includes("Boots") || !!i.from?.includes(BASE_BOOTS), tags: i.tags }] as const)),
      runes: new Map(ru.flatMap((s) => s.slots.flatMap((sl) => sl.runes.map((r) => [r.id, r.name] as const)))),
    };
  })().catch((e) => { p = null; throw e; }));
}

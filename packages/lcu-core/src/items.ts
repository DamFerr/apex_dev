import type { ChampionBuild } from "@apex/schema";

/** An item set as the League client stores it (/lol-item-sets). */
export interface LcuItemSet {
  uid: string; title: string; type: "custom"; map: "any"; mode: "any"; startedFrom: "blank"; sortrank: number;
  associatedChampions: number[]; associatedMaps: number[]; preferredItemSlots: unknown[];
  blocks: { type: string; items: { id: string; count: number }[]; hideIfSummonerSpell: string; showIfSummonerSpell: string; minSummonerLevel: number; maxSummonerLevel: number }[];
}
/** Apex only ever creates, replaces or removes item sets whose title starts with this prefix. Your own sets are never touched. */
export const ITEM_SET_PREFIX = "Apex: ";
/** At most this many Apex sets are kept (one per champion, newest first), so the client's list never fills up. */
export const MAX_APEX_SETS = 15;
const SUMMONERS_RIFT = 11;

/**
 * The item set for one champion, or null when the build has no items. Blocks, in order: Starting items and Build order (only when the
 * timeline sample has them), then Boots, Core items, Situational.
 */
export function buildItemSet(build: Pick<ChampionBuild, "itemBlocks"> & Partial<Pick<ChampionBuild, "startItems" | "corePath">>, championKey: number, championName: string): LcuItemSet | null {
  const plain = { hideIfSummonerSpell: "", showIfSummonerSpell: "", minSummonerLevel: -1, maxSummonerLevel: -1 };
  // When the Core block is already in build order, a separate "Build order" block would list the same three items twice.
  const coreOrdered = build.itemBlocks.some((b) => b.ordered && b.items.length > 0);
  const lead = [["Starting items", build.startItems], ...(coreOrdered ? [] : [["Build order", build.corePath] as const])] as const;
  const blocks = [
    ...lead.flatMap(([type, p]) => (p?.items.length ? [{ type, items: p.items.map((i) => ({ id: String(i.id), count: i.count })), ...plain }] : [])),
    ...build.itemBlocks.filter((b) => b.items.length > 0).map((b) => ({ type: b.ordered ? `${b.name} (build order)` : b.name, items: b.items.map((i) => ({ id: String(i.id), count: 1 })), ...plain })),
  ];
  if (!blocks.length) return null;
  return { uid: `apex-${championKey}`, title: `${ITEM_SET_PREFIX}${championName}`.slice(0, 40), type: "custom", map: "any", mode: "any", startedFrom: "blank", sortrank: 1,
    associatedChampions: [championKey], associatedMaps: [SUMMONERS_RIFT], preferredItemSlots: [], blocks };
}

/**
 * The full list to write back to the client: every set that is not Apex's stays exactly as it is, the set for this champion is replaced,
 * and older Apex sets are trimmed to MAX_APEX_SETS. The client replaces the whole list on write, so this must never drop a foreign set.
 */
export function mergeItemSets(existing: Pick<LcuItemSet, "uid" | "title">[] & unknown[], mine: LcuItemSet): unknown[] {
  const isApex = (s: unknown) => typeof (s as { title?: unknown }).title === "string" && (s as { title: string }).title.startsWith(ITEM_SET_PREFIX);
  const others = existing.filter((s) => !isApex(s)), apex = existing.filter((s) => isApex(s) && (s as { uid?: string }).uid !== mine.uid);
  return [...others, mine, ...apex.slice(0, MAX_APEX_SETS - 1)];
}

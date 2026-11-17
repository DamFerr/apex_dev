import type { ChampionBuild } from "@apex/schema";
import { itemLayout, sortVariants, DEFAULT_VARIANT_SORT, type PageCore } from "./pageBuild";

/** An item set as the League client stores it (/lol-item-sets). */
export interface LcuItemSet {
  uid: string; title: string; type: "custom"; map: "any"; mode: "any"; startedFrom: "blank"; sortrank: number;
  associatedChampions: number[]; associatedMaps: number[]; preferredItemSlots: unknown[];
  blocks: { type: string; items: { id: string; count: number }[]; hideIfSummonerSpell: string; showIfSummonerSpell: string; minSummonerLevel: number; maxSummonerLevel: number }[];
}
/** Apex only ever creates, replaces or removes item sets whose title starts with this prefix. Your own sets are never touched. */
export const ITEM_SET_PREFIX = "Apex: ";
/** At most this many Apex sets are kept (newest first), so the client's list never fills up. A champion with three build variants uses three. */
export const MAX_APEX_SETS = 30;
const SUMMONERS_RIFT = 11;

/**
 * The item set for one champion build, or null when it has no items. The blocks are exactly what the champion page shows, in the same order
 * (see `itemLayout`): Starting items, Build order (core items with the usual boots where they are bought), Boots options (the OTHER boots),
 * Situational, or Core items by popularity when there is no order. Every item appears once.
 * `variant` (AP / AD / Tank) makes the title and uid specific, so each variant is its own set.
 */
export function buildItemSet(build: Pick<PageCore, "itemBlocks"> & Partial<Pick<PageCore, "startItems" | "corePath" | "buildOrder">>, championKey: number, championName: string, variant?: { id: string; label: string }, sortrank = 1): LcuItemSet | null {
  const plain = { hideIfSummonerSpell: "", showIfSummonerSpell: "", minSummonerLevel: -1, maxSummonerLevel: -1 };
  const { start, order, groups } = itemLayout(build);
  const block = (type: string, items: { id: number; count: number }[]) => (items.length ? [{ type, items: items.map((i) => ({ id: String(i.id), count: i.count })), ...plain }] : []);
  const blocks = [...block("Starting items", start?.items ?? []), ...block("Build order", order?.items ?? []), ...groups.flatMap((g) => block(g.label, g.items.map((i) => ({ id: i.id, count: 1 }))))];
  if (!blocks.length) return null;
  return { uid: variant ? `apex-${championKey}-${variant.id}` : `apex-${championKey}`, title: `${ITEM_SET_PREFIX}${championName}${variant ? ` (${variant.label})` : ""}`.slice(0, 40), type: "custom", map: "any", mode: "any", startedFrom: "blank", sortrank,
    associatedChampions: [championKey], associatedMaps: [SUMMONERS_RIFT], preferredItemSlots: [], blocks };
}

/** The sets to import for a champion: one per build variant the page shows (best first), or one set when it has no variants. */
export function buildItemSets(build: ChampionBuild, championKey: number, championName: string): LcuItemSet[] {
  const variants = sortVariants(build, DEFAULT_VARIANT_SORT);
  const sets = variants.length ? variants.map((v, i) => buildItemSet(v.build, championKey, championName, { id: v.id, label: v.label }, i + 1)) : [buildItemSet(build, championKey, championName)];
  return sets.filter((s): s is LcuItemSet => s !== null);
}

/**
 * The full list to write back to the client: every set that is not Apex's stays exactly as it is, this champion's earlier Apex sets (any variant)
 * are replaced by the new ones, and other champions' older Apex sets are trimmed to MAX_APEX_SETS. The client replaces the whole list on write,
 * so this must never drop a foreign set.
 */
export function mergeItemSets(existing: Pick<LcuItemSet, "uid" | "title">[] & unknown[], mine: LcuItemSet | LcuItemSet[]): unknown[] {
  const list = Array.isArray(mine) ? mine : [mine], keys = new Set(list.flatMap((s) => s.associatedChampions));
  const isApex = (s: unknown) => typeof (s as { title?: unknown }).title === "string" && (s as { title: string }).title.startsWith(ITEM_SET_PREFIX);
  const ofMine = (s: unknown) => { const uid = (s as { uid?: unknown }).uid; return typeof uid === "string" && [...keys].some((k) => uid === `apex-${k}` || uid.startsWith(`apex-${k}-`)); };
  const others = existing.filter((s) => !isApex(s)), apex = existing.filter((s) => isApex(s) && !ofMine(s));
  return [...others, ...list, ...apex.slice(0, Math.max(0, MAX_APEX_SETS - list.length))];
}

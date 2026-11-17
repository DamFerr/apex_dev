import { shrink, wilson } from "@apex/stats-core";
import type { BuildItem, BuildVariant, ChampionBuild, ItemPathStat, SpellPairStat } from "@apex/schema";

/**
 * "What is the build of this champion?", decided in ONE place so the champion page, the overlay and the draft import can never drift apart
 * (the boots bug came from three copies of the same rule). Pure and unit tested.
 */

/** One build as the page shows it: the whole champion, or one variant (AP / AD / Tank). */
export type PageCore = Omit<ChampionBuild, "variants">;
export type VariantSort = "best" | "rate" | "common";
/** The sort tab the champion page opens with, and the one the import uses. */
export const DEFAULT_VARIANT_SORT: VariantSort = "best";

/** Variants in the order of the chosen tab. Best = lower end of the Wilson range (small samples cannot win), Win rate = shrunk win rate, Common = games. */
export function sortVariants(b: Pick<ChampionBuild, "variants">, sort: VariantSort): BuildVariant[] {
  const key = (v: { wins: number; games: number }) => (sort === "best" ? wilson(v.wins, v.games)[0] : sort === "rate" ? shrink(v.wins, v.games, 0.5, 50) : v.games);
  return [...(b.variants ?? [])].sort((x, y) => key(y) - key(x) || y.games - x.games);
}

/** The build the page shows: the chosen variant (default: the first of the sort), or the whole champion when it has no variants. */
export function pageBuild(b: ChampionBuild, sort: VariantSort = DEFAULT_VARIANT_SORT, variantId?: string): { core: PageCore; variant: BuildVariant | null } {
  const sorted = sortVariants(b, sort), variant = sorted.find((v) => v.id === variantId) ?? sorted[0] ?? null;
  return { core: variant ? variant.build : b, variant };
}

/** The summoner spell pairs the page shows (up to two); the first one is what the import sets. Flash is always second here, the key setting swaps it later. */
export const spellPairsOf = (core: Pick<PageCore, "spells" | "spellPairs">): SpellPairStat[] => (core.spellPairs?.length ? core.spellPairs : core.spells ? [core.spells] : []);

/**
 * How the items of a build are laid out, for the page and for the item set. Every item appears exactly once:
 *  - `start`: starting items (needs timeline games),
 *  - `order`: the build order, the core items WITH the usual boots where they are bought (falls back to the core path without boots),
 *  - `groups`: the rest, without anything already in the order: "Boots options" (the other boots), "Situational", and "Core items" (by popularity) only when there is no order.
 */
export interface ItemGroup { key: string; label: string; items: BuildItem[] }
export interface ItemLayout { start: ItemPathStat | null; order: ItemPathStat | null; groups: ItemGroup[] }
export function itemLayout(core: Pick<PageCore, "itemBlocks"> & Partial<Pick<PageCore, "startItems" | "corePath" | "buildOrder">>): ItemLayout {
  const order = core.buildOrder ?? core.corePath ?? null, inOrder = new Set(order?.items.map((i) => i.id));
  const groups = core.itemBlocks.filter((blk) => !(order && blk.name === "Core items"))
    .map((blk) => ({ key: blk.name, label: blk.name === "Boots" ? "Boots options" : blk.name, items: blk.items.filter((i) => !inOrder.has(i.id)) }))
    .filter((g) => g.items.length > 0);
  return { start: core.startItems ?? null, order, groups };
}

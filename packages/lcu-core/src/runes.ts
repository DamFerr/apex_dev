/** Builds a rune page payload for the League client from Data Dragon rune trees. Pure, so it is unit tested. */
export interface RuneStyle { id: number; key: string; name: string; icon?: string; slots: { runes: { id: number; name: string; icon?: string }[] }[] }
export interface RunePage { name: string; primaryStyleId: number; subStyleId: number; selectedPerkIds: number[]; current: boolean }

/** Apex only ever creates or overwrites pages whose name starts with this prefix. */
export const RUNE_PAGE_PREFIX = "Apex: ";
/** Adaptive Force, Adaptive Force, Health. Stat shard ids are not in Data Dragon's rune trees. */
export const SHARDS = [5008, 5008, 5011];
/** Stat shard ids (not part of Data Dragon's rune trees) and their in-game names. */
export const SHARD_NAMES: Record<number, string> = { 5001: "Scaling Health", 5002: "Armor", 5003: "Magic Resist", 5005: "Attack Speed", 5007: "Ability Haste", 5008: "Adaptive Force", 5010: "Move Speed", 5011: "Health", 5013: "Tenacity and Slow Resist" };
/**
 * The options of each stat shard row (offense, flex, defense), for showing the chosen shard among the others. Written from the game's current
 * shard layout; the UI always adds the shard a page really uses if it is not listed, so a change by Riot cannot hide a chosen shard.
 */
export const SHARD_ROWS: number[][] = [[5008, 5005, 5007], [5008, 5010, 5001], [5011, 5013, 5001]];
/**
 * Stat shard icon files under Data Dragon's `cdn/img/` (shard ids are not in runesReforged.json). Keyed like SHARD_NAMES.
 * If a file is ever missing the UI falls back to the shard's name, so a wrong entry degrades to text and never breaks a screen.
 */
export const SHARD_ICONS: Record<number, string> = {
  5001: "perk-images/StatMods/StatModsHealthScalingIcon.png", 5002: "perk-images/StatMods/StatModsArmorIcon.png", 5003: "perk-images/StatMods/StatModsMagicResIcon.png",
  5005: "perk-images/StatMods/StatModsAttackSpeedIcon.png", 5007: "perk-images/StatMods/StatModsCDRScalingIcon.png", 5008: "perk-images/StatMods/StatModsAdaptiveForceIcon.png",
  5010: "perk-images/StatMods/StatModsMovementSpeedIcon.png", 5011: "perk-images/StatMods/StatModsHealthPlusIcon.png", 5013: "perk-images/StatMods/StatModsTenacityIcon.png",
};
const PRIMARY_BY_TAG: Record<string, string> = { Mage: "Sorcery", Marksman: "Precision", Assassin: "Domination", Fighter: "Precision", Tank: "Resolve", Support: "Resolve" };

/**
 * Default recommendation: a valid page chosen by champion class (first rune of each row).
 * Win-rate-based pages will replace this once build data is collected; the write path to the client stays the same.
 */
export function buildRunePage(styles: RuneStyle[], tags: string[], champion: string): RunePage {
  const byKey = (k: string) => styles.find((s) => s.key === k);
  const primary = byKey(PRIMARY_BY_TAG[tags[0]] ?? "Precision") ?? styles[0];
  const secondary = byKey(primary?.key === "Inspiration" ? "Resolve" : "Inspiration") ?? styles.find((s) => s.id !== primary?.id);
  if (!primary || !secondary) throw new Error("Rune data incomplete");
  const first = (s: RuneStyle, row: number) => s.slots[row]?.runes[0]?.id;
  const ids = [0, 1, 2, 3].map((i) => first(primary, i)).concat([1, 2].map((i) => first(secondary, i)), SHARDS);
  if (ids.some((x) => x === undefined)) throw new Error("Rune data incomplete");
  return { name: `${RUNE_PAGE_PREFIX}${champion}`.slice(0, 25), primaryStyleId: primary.id, subStyleId: secondary.id, selectedPerkIds: ids as number[], current: true };
}

/**
 * A rune page from a collected setup (see ChampionBuild.runePages). Same name prefix and "current" flag as the default page,
 * so it overwrites the same "Apex: " page. Throws on a malformed page rather than sending nonsense to the client.
 */
export function runePageFromStat(stat: { primaryStyleId: number; subStyleId: number; perkIds: number[] }, champion: string): RunePage {
  const ids = stat.perkIds;
  if (ids.length !== 9 || new Set(ids.slice(0, 6)).size !== 6 || ids.some((x) => !Number.isInteger(x) || x <= 0) || stat.primaryStyleId === stat.subStyleId) throw new Error("Rune page data is invalid");
  return { name: `${RUNE_PAGE_PREFIX}${champion}`.slice(0, 25), primaryStyleId: stat.primaryStyleId, subStyleId: stat.subStyleId, selectedPerkIds: ids, current: true };
}

/** A rune page as the client lists it (/lol-perks/v1/pages); only the fields Apex needs. */
export interface ClientRunePage { id: number; name: string; isEditable: boolean; current?: boolean }

/**
 * Which of the client's rune pages is "the" Apex page: the one to overwrite, and the extra Apex pages to delete, so there is never more than one
 * "Apex: ..." page (older versions, or two imports at once, could leave several). The page that is currently selected wins, else the first one.
 * Pages that are not editable or do not start with the prefix are never touched.
 */
export function planApexRunePages(pages: ClientRunePage[]): { keep: number | null; remove: number[] } {
  const mine = pages.filter((p) => p.isEditable && p.name.startsWith(RUNE_PAGE_PREFIX));
  const keep = mine.find((p) => p.current) ?? mine[0];
  return { keep: keep?.id ?? null, remove: mine.filter((p) => p !== keep).map((p) => p.id) };
}

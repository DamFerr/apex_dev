/** Builds a rune page payload for the League client from Data Dragon rune trees. Pure, so it is unit tested. */
export interface RuneStyle { id: number; key: string; name: string; icon?: string; slots: { runes: { id: number; name: string; icon?: string }[] }[] }
export interface RunePage { name: string; primaryStyleId: number; subStyleId: number; selectedPerkIds: number[]; current: boolean }

/** Apex only ever creates or overwrites pages whose name starts with this prefix. */
export const RUNE_PAGE_PREFIX = "Apex: ";
/** Adaptive Force, Adaptive Force, Health. Stat shard ids are not in Data Dragon's rune trees. */
export const SHARDS = [5008, 5008, 5011];
/** Stat shard ids (not part of Data Dragon's rune trees) and their in-game names. */
export const SHARD_NAMES: Record<number, string> = { 5001: "Scaling Health", 5002: "Armor", 5003: "Magic Resist", 5005: "Attack Speed", 5007: "Ability Haste", 5008: "Adaptive Force", 5010: "Move Speed", 5011: "Health", 5013: "Tenacity and Slow Resist" };
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

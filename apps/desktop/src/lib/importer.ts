import { invoke } from "@tauri-apps/api/core";
import type { ChampionBuild, Role, StatsFilter } from "@apex/schema";
import { buildItemSet, buildRunePage, mergeItemSets, placeFlash, recommendSpells, runePageFromStat, RUNE_PAGE_PREFIX, SPELL_NAMES } from "@apex/lcu-core";
import { api } from "./api";
import { champIndex, fetchDdChampions, fetchRunes } from "./ddragon";
import { useUi } from "./store";

const lcu = <T,>(method: string, path: string, body?: unknown) => invoke<T>("lcu_request", { method, path, body });

/** A rune page or spell pair needs at least this many collected games, or Apex says so and uses its defaults instead. */
export const MIN_BUILD_GAMES = 10;

/**
 * What collected games say about this champion. Tries your current filters and role first, then all patches, then all roles,
 * and returns the first result that has enough games for a rune page. null = nothing usable (offline, unknown champion, no data yet).
 */
export async function fetchBuild(championKey: number, role: Role | null): Promise<ChampionBuild | null> {
  if (!champIndex.size) await fetchDdChampions().catch(() => undefined);
  const id = champIndex.get(championKey)?.id; if (!id) return null;
  const f: StatsFilter = useUi.getState().statsFilter, anyPatch = { ...f, patch: "all" };
  const tries: [Role | undefined, StatsFilter][] = [[role ?? undefined, f], [role ?? undefined, anyPatch], [undefined, anyPatch]];
  let last: ChampionBuild | null = null;
  for (const [r, filter] of tries) {
    try { const b = await api.getChampionBuild(id, r, filter); last = b; if ((b.runePages[0]?.games ?? 0) >= MIN_BUILD_GAMES) return b; } catch { /* backend down: fall through to defaults */ }
  }
  return last;
}
export const hasRunes = (b: ChampionBuild | null) => (b?.runePages[0]?.games ?? 0) >= MIN_BUILD_GAMES;

/**
 * Writes a rune page to the real League client: the most played page of collected games, or class-based defaults when there is not enough data.
 * Safety rules: only ever creates or overwrites a page whose name starts with "Apex: ", never touches your own pages, and is only called after an explicit click or opt-in.
 */
export async function importRunes(championKey: number, build: ChampionBuild | null): Promise<{ name: string; source: string }> {
  if (!champIndex.size) await fetchDdChampions();
  const champ = champIndex.get(championKey);
  if (!champ) throw new Error("Unknown champion");
  const top = hasRunes(build) ? build!.runePages[0] : null;
  const page = top ? runePageFromStat(top, champ.name) : buildRunePage(await fetchRunes(), champ.tags, champ.name);
  const pages = await lcu<{ id: number; name: string; isEditable: boolean }[]>("GET", "/lol-perks/v1/pages");
  const mine = pages.find((p) => p.isEditable && p.name.startsWith(RUNE_PAGE_PREFIX));
  if (mine) await lcu("PUT", `/lol-perks/v1/pages/${mine.id}`, { ...page, id: mine.id });
  else await lcu("POST", "/lol-perks/v1/pages", page); // fails with a clear message if every rune page slot is used
  return { name: page.name, source: top ? `${top.games} collected games` : "class-based defaults" };
}

/** Sets your two summoner spells during champ select. Only possible while a champion select session exists. */
export async function importSpells(role: Role | null, build: ChampionBuild | null): Promise<{ text: string; source: string }> {
  const s = build?.spells, data = s && s.games >= MIN_BUILD_GAMES ? s : null;
  // The backend stays slot-agnostic (Flash second); the swap to your Flash key (Settings) happens here, on the client only.
  const [spell1Id, spell2Id] = placeFlash(data ? data.ids : recommendSpells(role), useUi.getState().flashSlot);
  await lcu("PATCH", "/lol-champ-select/v1/session/my-selection", { spell1Id, spell2Id });
  return { text: `${SPELL_NAMES[spell1Id] ?? spell1Id} + ${SPELL_NAMES[spell2Id] ?? spell2Id}`, source: data ? `${data.games} collected games` : "defaults by role" };
}

/**
 * Writes an item set titled "Apex: <champion>". The client replaces its whole list of item sets on write, so Apex reads the list first,
 * keeps every set that is not its own exactly as it is, and writes nothing at all if the list cannot be read.
 */
export async function importItemSet(championKey: number, build: ChampionBuild | null): Promise<string | null> {
  const champ = champIndex.get(championKey);
  if (!champ || !build || build.games < MIN_BUILD_GAMES) return null;
  const set = buildItemSet(build, championKey, champ.name);
  if (!set) return null;
  const me = await lcu<{ summonerId?: number }>("GET", "/lol-summoner/v1/current-summoner");
  if (!me?.summonerId) throw new Error("Could not read your summoner id from the League client");
  const path = `/lol-item-sets/v1/item-sets/${me.summonerId}/sets`, cur = await lcu<{ accountId?: number; itemSets?: unknown[] }>("GET", path);
  if (!Array.isArray(cur?.itemSets)) throw new Error("Could not read your existing item sets, so nothing was changed");
  await lcu("PUT", path, { accountId: cur.accountId ?? me.summonerId, itemSets: mergeItemSets(cur.itemSets as never, set), timestamp: Date.now() });
  return set.title;
}

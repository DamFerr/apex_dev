import { invoke } from "@tauri-apps/api/core";
import type { ChampionBuild, Role, StatsFilter } from "@apex/schema";
import { buildItemSets, buildRunePage, isApexItemSet, mergeItemSets, pageBuild, placeFlash, planApexRunePages, recommendSpells, runePageFromStat, SPELL_NAMES, type ClientRunePage } from "@apex/lcu-core";
import { api } from "./api";
import { champIndex, fetchDdChampions, fetchRunes } from "./ddragon";
import { resolveSetup, type PickSetup } from "./pickSetup";
import { useUi } from "./store";

const lcu = <T,>(method: string, path: string, body?: unknown) => invoke<T>("lcu_request", { method, path, body });

/**
 * Runs League client writes one after another. Two imports at once (an auto-import and a click, or a pick and a swap) would both read the page and
 * item set lists before either wrote, and could leave two "Apex: " rune pages or lose a write; queued, each one sees the result of the one before.
 */
let queue: Promise<unknown> = Promise.resolve();
export const serial = <T,>(job: () => Promise<T>): Promise<T> => { const run = queue.then(job, job); queue = run.catch(() => undefined); return run; };

/** A rune page or spell pair needs at least this many collected games, or Apex says so and uses its defaults instead. */
export const MIN_BUILD_GAMES = 10;

/**
 * What collected games say about this champion. Tries your current filters and role first, then the last 5 patches, then all roles,
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
/**
 * The importer reads the SAME build the champion page shows (`pageBuild`: the best variant, or the whole champion without variants), so the
 * imported runes, spells and items are what the page says. Variants only change which games the numbers come from.
 */
export const hasRunes = (b: ChampionBuild | null) => (b ? (pageBuild(b).core.runePages[0]?.games ?? 0) >= MIN_BUILD_GAMES : false);

/**
 * Writes a rune page to the real League client: the most played page of collected games, or class-based defaults when there is not enough data.
 * Safety rules: only ever creates, overwrites or deletes pages whose name starts with "Apex: ", never touches your own pages, and is only called after an explicit
 * click or opt-in. There is always at most ONE Apex page: it is overwritten with the new champion's runes, and any extra Apex pages (older versions) are deleted.
 */
export const importRunes = (championKey: number, build: ChampionBuild | null, sel?: PickSetup) => serial(async (): Promise<{ name: string; source: string }> => {
  if (!champIndex.size) await fetchDdChampions();
  const champ = champIndex.get(championKey);
  if (!champ) throw new Error("Unknown champion");
  const top = resolveSetup(build, sel, MIN_BUILD_GAMES).rune;   // your pick from the setup page, else the top page when it has enough games
  const page = top ? runePageFromStat(top, champ.name) : buildRunePage(await fetchRunes(), champ.tags, champ.name);
  const { keep, remove } = planApexRunePages(await lcu<ClientRunePage[]>("GET", "/lol-perks/v1/pages"));
  if (keep !== null) await lcu("PUT", `/lol-perks/v1/pages/${keep}`, { ...page, id: keep });
  else await lcu("POST", "/lol-perks/v1/pages", page); // fails with a clear message if every rune page slot is used
  for (const id of remove) await lcu("DELETE", `/lol-perks/v1/pages/${id}`).catch(() => undefined);   // an extra Apex page that cannot be deleted is not worth failing the import
  return { name: page.name, source: top ? `${top.games} collected games` : "class-based defaults" };
});

/** Sets your two summoner spells during champ select. Only possible while a champion select session exists. */
export async function importSpells(role: Role | null, build: ChampionBuild | null, sel?: PickSetup): Promise<{ text: string; source: string }> {
  const data = resolveSetup(build, sel, MIN_BUILD_GAMES).spell;
  // The backend stays slot-agnostic (Flash second); the swap to your Flash key (Settings) happens here, on the client only.
  const [spell1Id, spell2Id] = placeFlash(data ? data.ids : recommendSpells(role), useUi.getState().flashSlot);
  await lcu("PATCH", "/lol-champ-select/v1/session/my-selection", { spell1Id, spell2Id });
  return { text: `${SPELL_NAMES[spell1Id] ?? spell1Id} + ${SPELL_NAMES[spell2Id] ?? spell2Id}`, source: data ? `${data.games} collected games` : "defaults by role" };
}

/**
 * Writes the item sets of a champion: one titled "Apex: <champion>" or, when the page shows build variants, one per variant ("Apex: Ahri (AP)"),
 * each laid out like the page (starting items, build order with the boots in it, boots options, situational). After the write the only Apex sets in the
 * client are these: Apex sets of earlier champions are deleted. The client replaces its whole list of item sets on write, so Apex reads the list first,
 * keeps every set that is not its own exactly as it is, and writes nothing at all if the list cannot be read. A champion without enough data gets no
 * sets, and the old Apex sets are still removed. Returns the titles written, or null when there was nothing to import (or no build data to judge by).
 */
export const importItemSet = (championKey: number, build: ChampionBuild | null) => serial(async (): Promise<string[] | null> => {
  const champ = champIndex.get(championKey);
  if (!champ || !build) return null;                       // offline or unknown champion: leave the client as it is
  const sets = build.games >= MIN_BUILD_GAMES ? buildItemSets(build, championKey, champ.name) : [];
  const me = await lcu<{ summonerId?: number }>("GET", "/lol-summoner/v1/current-summoner");
  if (!me?.summonerId) throw new Error("Could not read your summoner id from the League client");
  const path = `/lol-item-sets/v1/item-sets/${me.summonerId}/sets`, cur = await lcu<{ accountId?: number; itemSets?: unknown[] }>("GET", path);
  if (!Array.isArray(cur?.itemSets)) throw new Error("Could not read your existing item sets, so nothing was changed");
  if (!sets.length && !cur.itemSets.some(isApexItemSet)) return null;   // nothing to write and nothing of ours to remove
  await lcu("PUT", path, { accountId: cur.accountId ?? me.summonerId, itemSets: mergeItemSets(cur.itemSets, sets), timestamp: Date.now() });
  return sets.length ? sets.map((s) => s.title) : null;
});

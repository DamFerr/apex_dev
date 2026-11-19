import type { BuildItem, BuildItemBlock, ChampionBuild, KeystoneStat, ItemPathStat, ItemWpa, PathItem, Role, RunePageStat, SkillOrderStat, SpellPairStat } from "@apex/schema";
import { itemWpa } from "@apex/stats-core";
import { buildVariants } from "./buildKinds";

/** One collected game of a champion (see Store.buildRows). */
export interface BuildRow { /** Keystone rune id: stored for every game, also those collected before full rune pages were. */ keystone?: number | null; perks: string | null; items: string; spell1: number | null; spell2: number | null; win: number; skills?: string | null; start?: string | null; buys?: string | null; /** Game length in seconds (needed for WPA). */ duration?: number }
export interface ItemMeta { name: string; total: number; hasUpgrade: boolean; boots?: boolean; /** Data Dragon item tags (SpellDamage, Damage, Armor ...), used to tell AP, AD and Tank builds apart. */ tags?: string[]; /** Short stat keys read from the Data Dragon description (see ddragon.ts `itemStats`): ad, ap, armor, mr, hp, as, crit, leth, hsp, onhit, active ... */ stats?: string[] }

const FLASH = 4;
/** A build-order path needs at least this many games that kept the same core items; below it no path is shown (an arbitrary pick of 1-2 games is worse than nothing). */
export const MIN_PATH_GAMES = 10;
/**
 * Support quest items. World Atlas, Runic Compass and Bounty of Worlds are the quest line (they transform into each other and end the game as
 * one of five free upgrades), so the item a support ends with costs little or nothing and used to fail the 2000-gold rule below. The five
 * upgrades are the support's real "completed item" and are found by NAME (normalised, so a different apostrophe or case does not matter),
 * because Data Dragon has no tag that says it. The quest line itself is never a finished item. If Riot renames one, add it here.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const SUPPORT_UPGRADES = new Set(["Zaz'Zak's Realmspike", "Celestial Opposition", "Dream Maker", "Solstice Sleigh", "Bloodsong"].map(norm));
export const isSupportUpgrade = (it: ItemMeta | undefined): boolean => !!it && SUPPORT_UPGRADES.has(norm(it.name));
/** The one rule for a "finished" item (no boots, nothing it upgrades into, costs 2000+, or one of the five support upgrades). Core items, situational items, the champion Items table and the core path all use it, so they always agree. */
export const isFinished = (it: ItemMeta | undefined): it is ItemMeta => !!it && !it.boots && !it.hasUpgrade && (it.total >= 2000 || isSupportUpgrade(it));
/**
 * The one rule for boots. Boots come in three tiers (basic 300g, tier 2 around 900-1200g, tier 3 around 1850g), so a boots item that
 * "builds into" something is NOT unfinished: most players end the game in tier 2, which builds into tier 3. Only the basic tier (and
 * cheap boots-like items) is excluded, by cost. A final inventory holds one boots item, so tiers never double count.
 */
export const MIN_BOOTS_COST = 800;
export const isBoots = (it: ItemMeta | undefined): it is ItemMeta => !!it && !!it.boots && it.total >= MIN_BOOTS_COST;
/** How many rune pages, boots, core items and situational items are returned. */
export const LIMITS = { runePages: 3, boots: 3, support: 3, core: 3, situational: 5 } as const;

interface Tally { games: number; wins: number }
const bump = (m: Map<string, Tally>, key: string, win: number) => { const t = m.get(key) ?? { games: 0, wins: 0 }; t.games++; t.wins += win; m.set(key, t); };
/** Entries of a tally map, most games first. Ties are broken by key so results never change between runs. */
const ranked = (m: Map<string, Tally>) => [...m].sort((a, b) => b[1].games - a[1].games || (a[0] < b[0] ? -1 : 1));
/** The most common value among the given ones. */
function mode<T>(xs: T[]): T {
  const c = new Map<T, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0][0];
}

interface Perks { p: number; s: number; r: number[]; h: number[] }
function parsePerks(json: string | null): Perks | null {
  if (!json) return null;
  try {
    const x = JSON.parse(json) as Perks;
    return Number.isInteger(x.p) && Number.isInteger(x.s) && x.r?.length === 6 && x.h?.length === 3 ? x : null;
  } catch { return null; }
}

/**
 * Rune pages: games are grouped into setups (primary tree + keystone + secondary tree). For each of the most played setups the page is
 * filled with the most common runes among that setup's games. Every part comes from real games, so the page is always valid:
 * the primary runes sit one per row (so each can be picked independently), the secondary pair is taken as the most common pair
 * (two runes from different rows, whichever they are) and the shards are one per row.
 * The win rate shown is that of the whole setup, never of an invented combination.
 */
export function runePages(rows: BuildRow[], limit: number = LIMITS.runePages): RunePageStat[] {
  const groups = new Map<string, { perks: Perks[]; wins: number }>();
  for (const row of rows) {
    const p = parsePerks(row.perks); if (!p) continue;
    const key = `${p.p}:${p.r[0]}:${p.s}`, g = groups.get(key) ?? { perks: [], wins: 0 };
    g.perks.push(p); g.wins += row.win; groups.set(key, g);
  }
  return [...groups].sort((a, b) => b[1].perks.length - a[1].perks.length || (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([, g]) => {
    const pair = mode(g.perks.map((p) => [...p.r.slice(4)].sort((a, b) => a - b).join(",")));
    return {
      primaryStyleId: g.perks[0].p, subStyleId: g.perks[0].s, games: g.perks.length, wins: g.wins,
      perkIds: [g.perks[0].r[0], ...[1, 2, 3].map((i) => mode(g.perks.map((p) => p.r[i]))), ...pair.split(",").map(Number), ...[0, 1, 2].map((i) => mode(g.perks.map((p) => p.h[i])))],
    };
  });
}

/** The most played summoner spell pairs (most played first), each with Flash on the second slot (the usual F key). */
export function spellPairs(rows: BuildRow[], limit = 2): SpellPairStat[] {
  const m = new Map<string, Tally>();
  for (const r of rows) if (r.spell1 && r.spell2 && r.spell1 !== r.spell2) bump(m, [r.spell1, r.spell2].sort((a, b) => a - b).join(","), r.win);
  return ranked(m).slice(0, limit).map(([key, t]) => {
    const ids = key.split(",").map(Number);
    if (ids[0] === FLASH) ids.reverse();
    return { ids: [ids[0], ids[1]] as [number, number], games: t.games, wins: t.wins };
  });
}
/** The most played summoner spell pair, with Flash on the second slot (the usual F key). */
export const spellPair = (rows: BuildRow[]): SpellPairStat | null => spellPairs(rows, 1)[0] ?? null;

/**
 * Item blocks from the final inventories of the games: Boots, Core items (most built) and Situational items (next most built).
 * "Core" means most often owned at the end, not a build order: order needs timelines, which are not collected yet.
 * Only finished items count: no components, consumables, trinkets or starter items.
 */
export function itemBlocks(rows: BuildRow[], items: Map<number, ItemMeta>, wpas: Map<number, ItemWpa> = new Map(), order: number[] = []): BuildItemBlock[] {
  const boots = new Map<string, Tally>(), support = new Map<string, Tally>(), done = new Map<string, Tally>();
  for (const r of rows) {
    let ids: number[]; try { ids = JSON.parse(r.items) as number[]; } catch { continue; }
    for (const id of new Set(ids)) { // a duplicate (two copies) counts once per game
      const it = items.get(id);
      if (isBoots(it)) bump(boots, String(id), r.win); else if (isSupportUpgrade(it)) bump(support, String(id), r.win); else if (isFinished(it)) bump(done, String(id), r.win);
    }
  }
  const one = (id: number, t: Tally): BuildItem => ({ id, name: items.get(id)!.name, games: t.games, wins: t.wins, ...(wpas.has(id) ? { wpa: wpas.get(id) } : {}) });
  const take = (m: Map<string, Tally>, from: number, to: number): BuildItem[] => ranked(m).slice(from, to).map(([id, t]) => one(Number(id), t));
  const { core, situational } = LIMITS;
  // Boots: the usual ones only. A kind of boots with under MIN_BOOTS_OPTION_SHARE of the games that ended with boots (a mage's Sorcerer's Shoes on an ADC, a one-off pick)
  // is noise, not an option; the most common boots always stay, so the block is never empty.
  const bootTotal = [...boots.values()].reduce((n, t) => n + t.games, 0);
  const bootOptions = (m: Map<string, Tally>) => ranked(m).filter(([, t], i) => i < 2 || t.games / bootTotal >= MIN_BOOTS_OPTION_SHARE).slice(0, LIMITS.boots);
  // With a usual build order (corePath) the Core block IS that order, so the same three items are never listed twice (once ordered, once not).
  // Their stats come from the same all-games tallies as every other item, and they are removed from Situational.
  const ordered = order.length > 0 && order.every((id) => done.has(String(id)));
  const coreItems = ordered ? order.map((id) => one(id, done.get(String(id))!)) : take(done, 0, core);
  const coreIds = new Set(coreItems.map((i) => i.id));
  const rest = new Map([...done].filter(([id]) => !coreIds.has(Number(id))));
  return [{ name: "Support item", items: take(support, 0, LIMITS.support) }, { name: "Boots", items: bootOptions(boots).map(([id, t]) => one(Number(id), t)) }, { name: "Core items", items: coreItems, ...(ordered ? { ordered: true } : {}) },
    { name: "Situational", items: take(rest, 0, situational) }].filter((b) => b.items.length > 0);
}

/** The most played keystones (stored for every game). Fallback for the Runes column when no game has a full rune page yet. */
export function keystoneStats(rows: BuildRow[], limit = 3): KeystoneStat[] {
  const m = new Map<string, Tally>();
  for (const r of rows) if (r.keystone) bump(m, String(r.keystone), r.win);
  return ranked(m).slice(0, limit).map(([id, t]) => ({ id: Number(id), games: t.games, wins: t.wins }));
}

const json = <T,>(s: string | null | undefined): T | null => { if (!s) return null; try { return JSON.parse(s) as T; } catch { return null; } };
const SKILL = ["Q", "W", "E", "R"];

/** Order in which Q, W and E reach rank 5 (never-maxed skills come last, by points spent). Needs at least 9 skill points, otherwise null. */
export function skillPriority(skills: number[]): string[] | null {
  if (skills.length < 9) return null;
  const n = [0, 0, 0, 0, 0], maxedAt: Record<number, number> = {};
  skills.forEach((s, i) => { n[s]++; if (s <= 3 && n[s] === 5) maxedAt[s] = i; });
  return [1, 2, 3].sort((a, b) => (maxedAt[a] ?? 99) - (maxedAt[b] ?? 99) || n[b] - n[a] || a - b).map((s) => SKILL[s - 1]);
}

/**
 * All 18 skill levels for display. Levels 1-9 are the real sequence; later levels are not observed per level, so they follow the rules of the game
 * and the max order: R at 11 and 16 (its third rank), otherwise the next skill of the max order that is not yet at rank 5. Always exactly 18 entries.
 */
export function skillGrid(levels: string[], max: string[]): string[] {
  const grid = levels.slice(0, 18), n: Record<string, number> = { Q: 0, W: 0, E: 0, R: 0 };
  for (const k of grid) n[k]++;
  for (let lvl = grid.length + 1; lvl <= 18; lvl++) {
    const room = (k: string) => n[k] < (k === "R" ? 3 : 5);
    const pick = (lvl === 6 || lvl === 11 || lvl === 16) && room("R") ? "R" : [...max, "Q", "W", "E", "R"].find(room) ?? "R";
    grid.push(pick); n[pick]++;
  }
  return grid;
}

/** Most played skill priority and, among games with it, the most common first 9 skill points (a real sequence, never a mix). */
export function skillOrder(rows: BuildRow[], minGames: number = MIN_PATH_GAMES): SkillOrderStat | null {
  const groups = new Map<string, { levels: string[]; wins: number }>();
  for (const r of rows) {
    const sk = json<number[]>(r.skills); if (!sk || sk.some((x) => !(x >= 1 && x <= 4))) continue;
    const pr = skillPriority(sk); if (!pr) continue;
    const g = groups.get(pr.join("")) ?? { levels: [], wins: 0 }; g.levels.push(sk.slice(0, 9).map((x) => SKILL[x - 1]).join("")); g.wins += r.win; groups.set(pr.join(""), g);
  }
  const top = [...groups].sort((a, b) => b[1].levels.length - a[1].levels.length || (a[0] < b[0] ? -1 : 1))[0]; if (!top || top[1].levels.length < minGames) return null; // a handful of games is a coin flip, not a usual order
  const max = top[0].split(""), levels = mode(top[1].levels).split("");
  return { max, levels, games: top[1].levels.length, wins: top[1].wins, grid: skillGrid(levels, max) };
}

/** Most common starting items (as a set, with counts such as 2 potions). Free items (trinkets) are left out. */
export function startItems(rows: BuildRow[], items: Map<number, ItemMeta>, minGames: number = MIN_PATH_GAMES): ItemPathStat | null {
  const groups = new Map<string, Tally>();
  for (const r of rows) {
    const ids = json<number[]>(r.start)?.filter((id) => (items.get(id)?.total ?? 0) > 0).sort((a, b) => a - b); if (!ids?.length) continue;
    bump(groups, ids.join(","), r.win);
  }
  const top = ranked(groups)[0]; if (!top || top[1].games < minGames) return null;
  const count = new Map<number, number>(); for (const id of top[0].split(",").map(Number)) count.set(id, (count.get(id) ?? 0) + 1);
  return { items: [...count].map(([id, c]): PathItem => ({ id, name: items.get(id)!.name, count: c })), games: top[1].games, wins: top[1].wins };
}

/**
 * The three core items in their usual build order, from games with a timeline.
 * - Only items the player KEPT count (they are in the final inventory), so sold, swapped or misclicked purchases cannot decide the path.
 * - "Finished" is the shared isFinished rule, the same one the Core items block uses.
 * - The three items are the most kept finished items among these games (so they match the Core items block); they are then ordered by the
 *   average position at which they were bought, over the games that kept all three. Order is not part of the grouping, so a few
 *   players swapping two items do not split the sample.
 * - games/wins are the games that kept all three. Under `minGames` the result is null: "not enough games", never an arbitrary pick.
 */
export function corePath(rows: BuildRow[], items: Map<number, ItemMeta>, minGames: number = MIN_PATH_GAMES): ItemPathStat | null {
  const seqs: { seq: number[]; win: number }[] = [], kept = new Map<number, number>();
  for (const r of rows) {
    const buys = json<number[]>(r.buys), final = json<number[]>(r.items); if (!buys || !final) continue;
    const owned = new Set(final), seq: number[] = [];
    for (const id of buys) if (owned.has(id) && isFinished(items.get(id)) && !isSupportUpgrade(items.get(id)) && !seq.includes(id)) seq.push(id);   // the support item and the boots have their own slots in the build order
    if (!seq.length) continue;
    seqs.push({ seq, win: r.win }); for (const id of seq) kept.set(id, (kept.get(id) ?? 0) + 1);
  }
  const core = [...kept].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3).map(([id]) => id);
  if (core.length < 3) return null;
  const sample = seqs.filter((s) => core.every((id) => s.seq.includes(id)));
  if (sample.length < Math.max(1, minGames)) return null;
  const avg = (id: number) => sample.reduce((t, s) => t + s.seq.indexOf(id), 0) / sample.length;
  const order = [...core].sort((a, b) => avg(a) - avg(b) || a - b);
  return { items: order.map((id) => ({ id, name: items.get(id)!.name, count: 1 })), games: sample.length, wins: sample.reduce((t, s) => t + s.win, 0) };
}

/**
 * The three core items AND the boots AND (for supports) the support item, in the order they are bought. Uses the same games as `corePath`
 * (those that kept all three core items), so the sample is the same. Boots and the support item are SLOTS of the order, decided by the one rule of the whole app:
 *  - boots: the slot exists when `MIN_BOOTS_SHARE` of the games ended with boots of ANY kind. It is decided from the FINAL INVENTORY (like the support item), not from the purchases:
 *    a timeline can miss the boots (bought in the first 90 s, or an upgrade chain), and then the champion's usual boots wrongly fell into "Boots options" only. It shows the most
 *    common boots and sits at the average place where the timeline shows them bought; where it never does, in 2nd place (the usual one);
 *  - support item (Zaz'Zak's, Celestial Opposition, Dream Maker, Solstice Sleigh, Bloodsong): same rule with `MIN_SUPPORT_SHARE`, decided from the FINAL INVENTORY, because
 *    the quest upgrade is not always recorded as a purchase in the timeline. Its place is the average place where the timeline does show it; where it never does, it
 *    comes first (the quest is usually finished before the first big item). It is never one of the three core items, so it can no longer fall into "Situational".
 * The other boots / support items go to their own blocks of `itemBlocks` ("Boots options", "Support item options"): every item is shown exactly once.
 * Null when there is no core path.
 */
/** A kind of boots is listed as an option only when it is at least this share of the games that ended with boots (the top two are always listed). */
export const MIN_BOOTS_OPTION_SHARE = 0.05;
export const MIN_BOOTS_SHARE = 0.2;   // hand-set: under 20% of the games ending with boots, boots are an exception and stay in "Boots options" only
export const MIN_SUPPORT_SHARE = 0.4;
export function buildOrder(rows: BuildRow[], items: Map<number, ItemMeta>, minGames: number = MIN_PATH_GAMES): ItemPathStat | null {
  const path = corePath(rows, items, minGames); if (!path) return null;
  const core = path.items.map((i) => i.id), BOOTS = -1, SUPPORT = -2;     // tokens: "whichever boots / support item this game had"
  const seqs: number[][] = [], bootsKept = new Map<number, number>(), supportKept = new Map<number, number>();
  for (const r of rows) {
    const buys = json<number[]>(r.buys), final = json<number[]>(r.items); if (!buys || !final) continue;
    const owned = new Set(final), seq: number[] = [];
    const boots = final.find((id) => isBoots(items.get(id))) ?? 0;                      // from the final inventory, not from the timeline (a final inventory holds one boots item)
    const support = final.find((id) => isSupportUpgrade(items.get(id))) ?? 0;          // from the final inventory, not from the timeline
    for (const id of buys) {
      if (!owned.has(id)) continue;
      const it = items.get(id);
      if (isSupportUpgrade(it)) { if (!seq.includes(SUPPORT)) seq.push(SUPPORT); }
      else if (isFinished(it)) { if (!seq.includes(id)) seq.push(id); }
      else if (isBoots(it) && !seq.includes(BOOTS)) seq.push(BOOTS);                  // where the timeline shows the boots bought
    }
    if (!core.every((id) => seq.includes(id))) continue;
    seqs.push(seq); if (boots) bootsKept.set(boots, (bootsKept.get(boots) ?? 0) + 1); if (support) supportKept.set(support, (supportKept.get(support) ?? 0) + 1);
  }
  const total = Math.max(1, seqs.length), sum = (m: Map<number, number>) => [...m.values()].reduce((t, n) => t + n, 0);
  const top = (m: Map<number, number>) => [...m].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
  const hasBoots = sum(bootsKept) / total >= MIN_BOOTS_SHARE, hasSupport = sum(supportKept) / total >= MIN_SUPPORT_SHARE;
  if (!hasBoots && !hasSupport) return path;
  const slots = [...core, ...(hasBoots ? [BOOTS] : []), ...(hasSupport ? [SUPPORT] : [])], pos = new Map<number, number>();
  for (const s of slots) {
    const at = seqs.filter((q) => q.includes(s)).map((q) => q.filter((x) => slots.includes(x)).indexOf(s));
    pos.set(s, at.length ? at.reduce((t, x) => t + x, 0) / at.length : s === BOOTS ? 0.5 : -1);   // never seen in a timeline: boots 2nd (between the first and second core item) (the usual place), the support item first
  }
  const tie = (t: number) => (t === SUPPORT ? -1 : t === BOOTS ? Infinity : t);        // equal places: support item first, boots last, core by id
  const order = [...slots].sort((a, b) => pos.get(a)! - pos.get(b)! || tie(a) - tie(b)).map((s) => (s === BOOTS ? top(bootsKept) : s === SUPPORT ? top(supportKept) : s));
  return { items: order.map((id) => ({ id, name: items.get(id)!.name, count: 1 })), games: path.games, wins: path.wins };
}

/** Game length bands in minutes: under 20, 20-25, 25-30, 30-35, 35 and longer. */
export const lengthBand = (sec: number) => Math.min(4, Math.max(0, Math.floor(sec / 300) - 3));
/** Most finished items counted when comparing games (5 means 5 or 6). */
const MAX_FINISHED_BAND = 5;

/**
 * Win Probability Added for every boots and finished item the champion owned at the end of its games (see stats-core `itemWpa`).
 * Games are compared only with games of the same length band and the same number of finished items, which removes most of the
 * "winners and long games own more items" bias. Items are final inventories, so this is still a correlation. Rows without a game length are skipped.
 */
export function itemWpas(rows: BuildRow[], items: Map<number, ItemMeta>): Map<number, ItemWpa> {
  const totals = new Map<string, Tally>(), owned = new Map<number, Map<string, Tally>>();
  for (const r of rows) {
    if (!(r.duration && r.duration > 0)) continue;
    const ids = json<number[]>(r.items); if (!ids) continue;
    const set = new Set(ids), finished = [...set].filter((id) => isFinished(items.get(id))).length;
    const stratum = `${lengthBand(r.duration)}:${Math.min(finished, MAX_FINISHED_BAND)}`;
    bump(totals, stratum, r.win);
    for (const id of set) {
      const it = items.get(id); if (!(isBoots(it) || isFinished(it))) continue;
      const m = owned.get(id) ?? new Map<string, Tally>(); bump(m, stratum, r.win); owned.set(id, m);
    }
  }
  const out = new Map<number, ItemWpa>();
  for (const [id, m] of owned) {
    const strata = [...totals].map(([k, all]) => { const o = m.get(k) ?? { games: 0, wins: 0 }; return { owners: o, others: { games: all.games - o.games, wins: all.wins - o.wins } }; });
    const w = itemWpa(strata); out.set(id, { wpa: w.wpa, lo: w.lo, hi: w.hi, expected: w.expected });
  }
  return out;
}

/**
 * Boots that the final inventory does not show. Since the 2026 role quests the bot lane keeps its boots in a dedicated 7th slot, which games stored
 * before Apex read that slot lack (and a game whose slot is never reported still would). The timeline still shows the purchase, so when a game has
 * a timeline and no boots in its final inventory, the LAST boots bought count as the final boots. Games without a timeline cannot be repaired.
 * Idempotent, and a game that already has boots is returned as it is.
 */
export function repairBoots(r: BuildRow, items: Map<number, ItemMeta>): BuildRow {
  const final = json<number[]>(r.items), buys = json<number[]>(r.buys);
  if (!final || !buys || final.some((id) => isBoots(items.get(id)))) return r;
  const last = [...buys].reverse().find((id) => isBoots(items.get(id)));
  return last ? { ...r, items: JSON.stringify([...final, last]) } : r;
}

export function computeBuild(champion: string, role: Role | null, allRows: BuildRow[], items: Map<number, ItemMeta>, withVariants = true): ChampionBuild {
  const rows = allRows.map((r) => repairBoots(r, items));
  const path = corePath(rows, items), order = buildOrder(rows, items);
  const variants = withVariants ? buildVariants(champion, role, rows, items) : [];
  return { champion, role, games: rows.length, wins: rows.reduce((t, r) => t + r.win, 0), runePages: runePages(rows), keystones: keystoneStats(rows), spells: spellPair(rows), spellPairs: spellPairs(rows),
    itemBlocks: itemBlocks(rows, items, itemWpas(rows, items), path?.items.map((i) => i.id) ?? []),
    timelineGames: rows.filter((r) => r.skills || r.buys).length, skillOrder: skillOrder(rows), startItems: startItems(rows, items), corePath: path, buildOrder: order, minPathGames: MIN_PATH_GAMES,
    ...(variants.length ? { variants } : {}) };
}

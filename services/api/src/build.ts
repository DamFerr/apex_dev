import type { BuildItem, BuildItemBlock, ChampionBuild, ItemPathStat, PathItem, Role, RunePageStat, SkillOrderStat, SpellPairStat } from "@apex/schema";

/** One collected game of a champion (see Store.buildRows). */
export interface BuildRow { perks: string | null; items: string; spell1: number | null; spell2: number | null; win: number; skills?: string | null; start?: string | null; buys?: string | null }
export interface ItemMeta { name: string; total: number; hasUpgrade: boolean; boots?: boolean }

const FLASH = 4;
/** How many rune pages, boots, core items and situational items are returned. */
export const LIMITS = { runePages: 3, boots: 2, core: 3, situational: 5 } as const;

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

/** The most played summoner spell pair, with Flash on the second slot (the usual F key). */
export function spellPair(rows: BuildRow[]): SpellPairStat | null {
  const m = new Map<string, Tally>();
  for (const r of rows) if (r.spell1 && r.spell2 && r.spell1 !== r.spell2) bump(m, [r.spell1, r.spell2].sort((a, b) => a - b).join(","), r.win);
  const top = ranked(m)[0]; if (!top) return null;
  const ids = top[0].split(",").map(Number);
  if (ids[0] === FLASH) ids.reverse();
  return { ids: [ids[0], ids[1]], games: top[1].games, wins: top[1].wins };
}

/**
 * Item blocks from the final inventories of the games: Boots, Core items (most built) and Situational items (next most built).
 * "Core" means most often owned at the end, not a build order: order needs timelines, which are not collected yet.
 * Only finished items count: no components, consumables, trinkets or starter items.
 */
export function itemBlocks(rows: BuildRow[], items: Map<number, ItemMeta>): BuildItemBlock[] {
  const boots = new Map<string, Tally>(), done = new Map<string, Tally>();
  for (const r of rows) {
    let ids: number[]; try { ids = JSON.parse(r.items) as number[]; } catch { continue; }
    for (const id of new Set(ids)) { // a duplicate (two copies) counts once per game
      const it = items.get(id); if (!it || it.hasUpgrade) continue;
      if (it.boots) bump(boots, String(id), r.win); else if (it.total >= 2000) bump(done, String(id), r.win);
    }
  }
  const take = (m: Map<string, Tally>, from: number, to: number): BuildItem[] => ranked(m).slice(from, to).map(([id, t]) => ({ id: Number(id), name: items.get(Number(id))!.name, games: t.games, wins: t.wins }));
  const { core, situational } = LIMITS;
  return [{ name: "Boots", items: take(boots, 0, LIMITS.boots) }, { name: "Core items", items: take(done, 0, core) }, { name: "Situational", items: take(done, core, core + situational) }].filter((b) => b.items.length > 0);
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

/** Most played skill priority and, among games with it, the most common first 9 skill points (a real sequence, never a mix). */
export function skillOrder(rows: BuildRow[]): SkillOrderStat | null {
  const groups = new Map<string, { levels: string[]; wins: number }>();
  for (const r of rows) {
    const sk = json<number[]>(r.skills); if (!sk || sk.some((x) => !(x >= 1 && x <= 4))) continue;
    const pr = skillPriority(sk); if (!pr) continue;
    const g = groups.get(pr.join("")) ?? { levels: [], wins: 0 }; g.levels.push(sk.slice(0, 9).map((x) => SKILL[x - 1]).join("")); g.wins += r.win; groups.set(pr.join(""), g);
  }
  const top = [...groups].sort((a, b) => b[1].levels.length - a[1].levels.length || (a[0] < b[0] ? -1 : 1))[0]; if (!top) return null;
  return { max: top[0].split(""), levels: mode(top[1].levels).split(""), games: top[1].levels.length, wins: top[1].wins };
}

/** Most common starting items (as a set, with counts such as 2 potions). Free items (trinkets) are left out. */
export function startItems(rows: BuildRow[], items: Map<number, ItemMeta>): ItemPathStat | null {
  const groups = new Map<string, Tally>();
  for (const r of rows) {
    const ids = json<number[]>(r.start)?.filter((id) => (items.get(id)?.total ?? 0) > 0).sort((a, b) => a - b); if (!ids?.length) continue;
    bump(groups, ids.join(","), r.win);
  }
  const top = ranked(groups)[0]; if (!top) return null;
  const count = new Map<number, number>(); for (const id of top[0].split(",").map(Number)) count.set(id, (count.get(id) ?? 0) + 1);
  return { items: [...count].map(([id, c]): PathItem => ({ id, name: items.get(id)!.name, count: c })), games: top[1].games, wins: top[1].wins };
}

/** Most common first three finished items in the order they were bought (boots excluded). Only games that finished three items count. */
export function corePath(rows: BuildRow[], items: Map<number, ItemMeta>): ItemPathStat | null {
  const groups = new Map<string, Tally>();
  for (const r of rows) {
    const seen: number[] = [];
    for (const id of json<number[]>(r.buys) ?? []) { const it = items.get(id); if (it && !it.boots && !it.hasUpgrade && it.total >= 2000 && !seen.includes(id)) seen.push(id); }
    if (seen.length >= 3) bump(groups, seen.slice(0, 3).join(","), r.win);
  }
  const top = ranked(groups)[0]; if (!top) return null;
  return { items: top[0].split(",").map(Number).map((id) => ({ id, name: items.get(id)!.name, count: 1 })), games: top[1].games, wins: top[1].wins };
}

export function computeBuild(champion: string, role: Role | null, rows: BuildRow[], items: Map<number, ItemMeta>): ChampionBuild {
  return { champion, role, games: rows.length, runePages: runePages(rows), spells: spellPair(rows), itemBlocks: itemBlocks(rows, items),
    timelineGames: rows.filter((r) => r.skills || r.buys).length, skillOrder: skillOrder(rows), startItems: startItems(rows, items), corePath: corePath(rows, items) };
}

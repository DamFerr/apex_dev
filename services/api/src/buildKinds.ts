import { MIXED_ARCHETYPES, PURE_ARCHETYPES } from "@apex/schema";
import type { BuildArchetype, BuildItem, BuildVariant, ChampionBuild, ItemPathStat, PathItem, Role } from "@apex/schema";
import { computeBuild, isBoots, isFinished, isSupportUpgrade, itemBlocks, itemWpas, LIMITS, repairBoots, type BuildRow, type ItemMeta } from "./build";

/**
 * Build types, rebuilt (owner spec, Nov 2026). Every game becomes a signature [starter, tier 2 boots, core item 1, 2, 3] from its timeline,
 * every signature is scored with a weighted trait vector and resolved to ONE of the existing build names (never "most played" as a name),
 * signatures with the same name are rolled up into one build, and the situational items (4th-6th) are pooled per build only.
 * Pure, unit tested in buildKinds.test.ts.
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const json = <T,>(s: string | null | undefined): T | null => { if (!s) return null; try { return JSON.parse(s) as T; } catch { return null; } };

/** The traits an item can stand for. Each one has exactly one existing build name (`TRAIT_NAME`). */
export const TRAITS = ["AD", "AP", "Bruiser", "Crit", "Heal & Shield", "Lethality", "On-Hit", "Tank", "Utility"] as const;
export type Trait = (typeof TRAITS)[number];
type Kind = Trait;
const TRAIT_NAME: Record<Trait, BuildArchetype> = { AD: "AD", AP: "AP", Bruiser: "Bruiser", Crit: "Crit", "Heal & Shield": "Heal & Shield", Lethality: "Lethality", "On-Hit": "On-Hit", Tank: "Tank", Utility: "Utility" };

type ItemKinds = { kinds: Kind[]; ad: boolean; ap: boolean };
const K = (kinds: Kind[], ad = false, ap = false): ItemKinds => ({ kinds, ad, ap });
/**
 * Hand-kept answers for items whose text does not say what they are for (or says it badly). They win over the text rules of `itemKinds`, are
 * keyed by item name (letters and digits only, lower case, see `norm`) and are harmless when an item is renamed or removed: the text rules take over.
 * `ad` / `ap` say whether the item counts as AD / AP scaling for Hybrid; leave them out when it should not (Guinsoo's has AP in its text but belongs to On-Hit builds).
 * Add an item here when a champion's build shows up under the wrong kind; keep it short, the text rules handle most items.
 */
export const ITEM_KIND_OVERRIDES: ReadonlyMap<string, ItemKinds> = new Map(Object.entries({
  // Tank
  "Heartsteel": K(["Tank"]), "Sunfire Aegis": K(["Tank"]), "Thornmail": K(["Tank"]), "Randuin's Omen": K(["Tank"]), "Frozen Heart": K(["Tank"]), "Jak'Sho, The Protean": K(["Tank"]),
  "Warmog's Armor": K(["Tank"]), "Kaenic Rookern": K(["Tank"]), "Spirit Visage": K(["Tank"]), "Force of Nature": K(["Tank"]), "Abyssal Mask": K(["Tank"]), "Gargoyle Stoneplate": K(["Tank"]),
  // Tank / Utility
  "Locket of the Iron Solari": K(["Tank", "Utility"]), "Knight's Vow": K(["Tank", "Utility"]), "Zeke's Convergence": K(["Tank", "Utility"]),
  // Heal & Shield and Utility
  "Redemption": K(["Heal & Shield"]), "Moonstone Renewer": K(["Heal & Shield"], false, true), "Staff of Flowing Water": K(["Heal & Shield"], false, true), "Ardent Censer": K(["Heal & Shield"], false, true),
  "Mikael's Blessing": K(["Heal & Shield", "Utility"]), "Shurelya's Battlesong": K(["Utility"]), "Imperial Mandate": K(["Utility"]), "Echoes of Helia": K(["Heal & Shield"], false, true),
  // AP / Bruiser
  "Riftmaker": K(["AP", "Bruiser"], false, true), "Liandry's Torment": K(["AP", "Bruiser"], false, true), "Rod of Ages": K(["AP", "Bruiser"], false, true), "Cosmic Drive": K(["AP"], false, true),
  // Bruiser
  "Black Cleaver": K(["Bruiser"], true), "Sterak's Gage": K(["Bruiser"], true), "Trinity Force": K(["Bruiser"], true), "Death's Dance": K(["Bruiser"], true), "Sundered Sky": K(["Bruiser"], true),
  "Eclipse": K(["Bruiser"], true), "Hullbreaker": K(["Bruiser"], true), "Stridebreaker": K(["Bruiser"], true), "Titanic Hydra": K(["Bruiser"], true), "Maw of Malmortius": K(["Bruiser"], true), "Divine Sunderer": K(["Bruiser"], true),
  // Lethality (Collector is Crit and Lethality)
  "Collector": K(["Crit", "Lethality"], true), "Hubris": K(["Lethality"], true), "Opportunity": K(["Lethality"], true), "Serpent's Fang": K(["Lethality"], true), "Youmuu's Ghostblade": K(["Lethality"], true),
  "Duskblade of Draktharr": K(["Lethality"], true), "Voltaic Cyclosword": K(["Lethality"], true), "Axiom Arc": K(["Lethality"], true), "Profane Hydra": K(["Lethality"], true), "Edge of Night": K(["Lethality"], true),
  // On-Hit (and the Crit / On-Hit crossover)
  "Kraken Slayer": K(["On-Hit", "AD"], true), "Blade of the Ruined King": K(["On-Hit", "AD"], true), "Guinsoo's Rageblade": K(["On-Hit", "AD"], true), "Wit's End": K(["On-Hit"]), "Nashor's Tooth": K(["On-Hit", "AP"], false, true), "Terminus": K(["On-Hit", "AD"], true),
  "Yun Tal Wildarrows": K(["Crit", "On-Hit"], true), "Runaan's Hurricane": K(["Crit", "On-Hit"], true),
}).map(([name, v]) => [norm(name), v] as const));

/** What one item stands for: the kinds it counts towards (first = main one) and whether it scales with AD and/or AP. The override table first, then the text rules. */
export function itemKinds(it: ItemMeta): ItemKinds {
  const fixed = ITEM_KIND_OVERRIDES.get(norm(it.name)); if (fixed) return fixed;
  const st = new Set(it.stats ?? []), tg = new Set(it.tags ?? []), has = (stat: string, tag?: string) => st.has(stat) || (!!tag && tg.has(tag));
  const ad = has("ad", "Damage") || has("crit", "CriticalStrike") || has("leth", "ArmorPenetration"), ap = has("ap", "SpellDamage");
  const crit = has("crit", "CriticalStrike"), leth = st.has("leth") || (st.size === 0 && tg.has("ArmorPenetration")), hsp = st.has("hsp");
  const onhit = has("onhit", "OnHit"), health = has("hp", "Health"), defence = has("armor", "Armor") || has("mr", "SpellBlock");
  const active = st.has("active") || tg.has("Active") || tg.has("Aura") || tg.has("Slow");
  const kinds: Kind[] = [];
  if (hsp) { kinds.push("Heal & Shield"); if (defence) kinds.push("Tank"); }
  else if (onhit) { kinds.push("On-Hit"); if (crit) kinds.push("Crit"); else if (ad) kinds.push("AD"); else if (ap) kinds.push("AP"); }     // on-hit with AD = On-Hit / AD, on-hit with only AP = On-Hit / AP
  else if (leth) { if (crit) kinds.push("Crit"); kinds.push("Lethality"); }
  else if (crit) kinds.push("Crit");
  else if (ap) { kinds.push("AP"); if (health) kinds.push("Bruiser"); }
  else if (ad) kinds.push(health || defence ? "Bruiser" : "AD");
  else if (defence || health) { kinds.push("Tank"); if (active) kinds.push("Utility"); }
  else if (active) kinds.push("Utility");
  return { kinds, ad, ap };
}

// ---------------------------------------------------------------- weights (spec section 3)
/** Weight of core item 1, 2 and 3 (identity, synergy, completion). */
export const CORE_WEIGHTS = [1.5, 1.2, 1.0] as const;
/** Offensive boots only (defensive and utility boots count 0), and directional lane starters only (jungle pets, support items, Doran's Shield count 0). */
export const BOOTS_WEIGHT = 0.4, STARTER_WEIGHT = 0.2;

type Vec = Record<Trait, number>;
const zero = (): Vec => Object.fromEntries(TRAITS.map((t) => [t, 0])) as Vec;
const addTo = (v: Vec, w: Partial<Vec>, scale: number) => { for (const t of TRAITS) v[t] += (w[t] ?? 0) * scale; };
const total = (v: Vec) => TRAITS.reduce((n, t) => n + v[t], 0);

/** An item's trait vector: the kinds from `itemKinds` (main kind 0.7 and second kind 0.3, or 1.0 for one kind). No stats and no override = zero vector. */
export function itemVector(it: ItemMeta | undefined): Partial<Vec> {
  if (!it) return {};
  const kinds = itemKinds(it).kinds;
  return kinds.length === 0 ? {} : kinds.length === 1 ? { [kinds[0]!]: 1 } : { [kinds[0]!]: 0.7, [kinds[1]!]: 0.3 };
}
/** Offensive boots and directional starters, by item name (letters and digits only). */
const OFFENSIVE_BOOTS: Record<string, Partial<Vec>> = { sorcerersshoes: { AP: 1 }, berserkersgreaves: { AD: 0.4, "On-Hit": 0.3, Crit: 0.3 } };
const DIRECTIONAL_STARTERS: Record<string, Partial<Vec>> = { doransblade: { AD: 1 }, longsword: { AD: 1 }, doransring: { AP: 1 }, darkseal: { AP: 1 } };

export interface Signature { starter: number[]; boots: number; core: number[] }

/** The combined build vector (`combined`) and the part that comes from the offensive boots and the directional starter (`modifiers`, used to break ties). */
export function buildVector(sig: Signature, items: Map<number, ItemMeta>): { combined: Vec; modifiers: Vec } {
  const combined = zero(), modifiers = zero();
  sig.core.slice(0, 3).forEach((id, i) => addTo(combined, itemVector(items.get(id)), CORE_WEIGHTS[i]!));
  const boots = items.get(sig.boots); if (boots) addTo(modifiers, OFFENSIVE_BOOTS[norm(boots.name)] ?? {}, BOOTS_WEIGHT);
  for (const id of sig.starter) { const s = items.get(id); if (s) addTo(modifiers, DIRECTIONAL_STARTERS[norm(s.name)] ?? {}, STARTER_WEIGHT); }
  for (const t of TRAITS) combined[t] += modifiers[t];
  return { combined, modifiers };
}

// ---------------------------------------------------------------- label funnel (spec section 4)
/** Share of the normalised vector one trait needs to name the build on its own. */
export const DOMINANT_SHARE = 0.6;
/** Two names whose cosine similarity differs by less than this are tied; the starter and boots modifiers decide between them. */
const TIE = 0.02;

/** Name-keyed anchors: core items that define a build on their own, or a mandatory combination. Missing names are harmless (nothing matches). */
const ON_HIT_ITEMS = ["Kraken Slayer", "Blade of the Ruined King", "Guinsoo's Rageblade", "Terminus", "Wit's End"];
const HARD_OVERRIDES: { when: (names: Set<string>) => boolean; name: BuildArchetype }[] = (() => {
  const count = (names: Set<string>, list: string[]) => list.filter((n) => names.has(norm(n))).length;
  return [
    { name: "On-Hit / AP", when: (n) => n.has(norm("Nashor's Tooth")) && count(n, ON_HIT_ITEMS) >= 1 },
    { name: "On-Hit / AD", when: (n) => count(n, ["Kraken Slayer", "Blade of the Ruined King", "Guinsoo's Rageblade", "Terminus"]) >= 2 },
    { name: "Heal & Shield", when: (n) => count(n, ["Moonstone Renewer", "Ardent Censer", "Staff of Flowing Water", "Redemption", "Mikael's Blessing", "Echoes of Helia", "Dawncore"]) >= 2 },
    { name: "Tank / Utility", when: (n) => count(n, ["Locket of the Iron Solari", "Knight's Vow", "Zeke's Convergence"]) >= 2 },
    { name: "AP / Bruiser", when: (n) => count(n, ["Riftmaker", "Liandry's Torment", "Rod of Ages"]) >= 2 },
  ];
})();

/** Where each existing build name sits in trait space (cosine similarity target). Pure names are one trait, mixes two, Hybrid is AD + AP, Well Rounded is flat. */
const PROTOTYPES: { name: BuildArchetype; v: Vec }[] = (() => {
  const mk = (name: BuildArchetype, w: Partial<Vec>) => { const v = zero(); addTo(v, w, 1); return { name, v }; };
  const all = [
    ...TRAITS.map((t) => mk(TRAIT_NAME[t], { [t]: 1 })),
    mk("Hybrid", { AD: 0.5, AP: 0.5 }), mk("Well Rounded", Object.fromEntries(TRAITS.map((t) => [t, 1])) as Vec),
    mk("AP / Bruiser", { AP: 0.6, Bruiser: 0.4 }), mk("Bruiser / Lethality", { Bruiser: 0.5, Lethality: 0.5 }), mk("Bruiser / Tank", { Bruiser: 0.5, Tank: 0.5 }),
    mk("Crit / Lethality", { Crit: 0.5, Lethality: 0.5 }), mk("Crit / On-Hit", { Crit: 0.55, "On-Hit": 0.45 }), mk("On-Hit / Crit", { "On-Hit": 0.55, Crit: 0.45 }),
    mk("Heal & Shield / Tank", { "Heal & Shield": 0.5, Tank: 0.5 }), mk("On-Hit / AD", { "On-Hit": 0.55, AD: 0.45 }), mk("On-Hit / AP", { "On-Hit": 0.55, AP: 0.45 }), mk("Tank / Utility", { Tank: 0.5, Utility: 0.5 }),
  ];
  return all.filter((p) => (PURE_ARCHETYPES as readonly string[]).includes(p.name) || (MIXED_ARCHETYPES as readonly string[]).includes(p.name));
})();
const dot = (a: Vec, b: Vec) => TRAITS.reduce((n, t) => n + a[t] * b[t], 0);
const cosine = (a: Vec, b: Vec) => { const d = Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)); return d === 0 ? 0 : dot(a, b) / d; };

/**
 * The build name of one signature. Always returns one of the existing names, however little the signature has (1 or 2 core items are fine).
 * 1. hard override (anchor item or mandatory pair in the core);  2. one trait with 60% or more of the vector;
 * 3. closest prototype by cosine similarity, near ties decided by the starter and boots modifiers;  4. still tied: the heaviest single trait.
 */
export function classifySignature(sig: Signature, items: Map<number, ItemMeta>): BuildArchetype {
  const names = new Set(sig.core.map((id) => norm(items.get(id)?.name ?? "")));
  const anchor = HARD_OVERRIDES.find((o) => o.when(names)); if (anchor) return anchor.name;
  const { combined, modifiers } = buildVector(sig, items), sum = total(combined);
  if (sum <= 0) return "Well Rounded";
  const top = TRAITS.reduce((best, t) => (combined[t] > combined[best] ? t : best), TRAITS[0]);
  if (combined[top] / sum >= DOMINANT_SHARE) return TRAIT_NAME[top];
  const scored = PROTOTYPES.map((p) => ({ name: p.name, sim: cosine(combined, p.v), mod: dot(modifiers, p.v) })).sort((a, b) => b.sim - a.sim);
  const tied = scored.filter((s) => scored[0]!.sim - s.sim < TIE);
  if (tied.length === 1) return tied[0]!.name;
  const byMod = [...tied].sort((a, b) => b.mod - a.mod);
  return byMod[0]!.mod - byMod[1]!.mod > 1e-9 ? byMod[0]!.name : TRAIT_NAME[top];
}

// ---------------------------------------------------------------- extraction (spec section 1)
export interface GameBuild extends Signature { /** The whole start set as bought (potions and wards included, free items left out): what the page shows. `starter` (no consumables) only groups games. */ startFull: number[]; late: number[]; win: number; row: BuildRow; /** Core items bought before the boots (0-3), for the boots slot of the build order. */ bootsAt: number; timeline: boolean }
const isLegendary = (it: ItemMeta | undefined) => isFinished(it) && !isSupportUpgrade(it);

/**
 * One game as the four buckets. Starter: purchases up to 1:30 (already cut by the collector, undone purchases already removed); consumables and trinkets are left out of `starter` (grouping, weights) but kept in `startFull` (display, so potions show).
 * Boots: the first tier 2 boots bought. Core: the first three finished items in purchase order. Late: the finished items bought after the core is complete.
 * Games without a timeline use the final inventory (not in purchase order, starter unknown). A game without any finished item is not classified (null).
 */
export function extractGame(row: BuildRow, items: Map<number, ItemMeta>): GameBuild | null {
  const r = repairBoots(row, items), buys = json<number[]>(r.buys), final = json<number[]>(r.items) ?? [];
  const core: number[] = [], late: number[] = []; let boots = 0, bootsAt = 0, timeline = false;
  const take = (id: number) => { if (isLegendary(items.get(id)) && !core.includes(id) && !late.includes(id)) (core.length < 3 ? core : late).push(id); };
  if (buys && buys.length) {
    timeline = true;
    for (const id of buys) { if (!boots && isBoots(items.get(id))) { boots = id; bootsAt = core.length; } else take(id); }
  } else {
    for (const id of final) { if (isBoots(items.get(id))) boots ||= id; else take(id); }
    bootsAt = core.length;
  }
  if (!core.length) return null;
  const startFull = (json<number[]>(r.start) ?? []).filter((id) => (items.get(id)?.total ?? 0) > 0).sort((a, b) => a - b);
  const starter = startFull.filter((id) => { const it = items.get(id)!; return !it.tags?.includes("Consumable") && !it.tags?.includes("Trinket"); });
  return { starter, startFull, boots, core, late, win: r.win, row: r, bootsAt, timeline };
}

// ---------------------------------------------------------------- roll-up (spec sections 2 and 5)
/** Games from which the 1% noise rule for signatures applies; below it every signature is kept (new patches, rare champions). */
export const ABUNDANT_GAMES = 200, NOISE_SHARE = 0.01, MAX_VARIANTS = 4, SITUATIONAL_OFF_ARCHETYPE_SHARE = 0.05;
/**
 * Which games may form builds. A game with fewer than 3 finished items (early surrender, remake, a very short game) has no core, so it is NOT a build:
 * once a champion has MIN_COMPLETE_GAMES games with a full core, only those count. Only below that (new patch, rare pick) are partial games used, so a name still exists.
 * With full-core games a build must have MIN_BUILD_GAMES games (the app's "low data" line) and MIN_BUILD_SHARE of them; with partial games a build needs
 * MIN_LOW_DATA_GAMES games and MIN_LOW_DATA_SHARE of them (the most played build always stays).
 */
export const MIN_COMPLETE_GAMES = 30, MIN_BUILD_GAMES = 50, MIN_BUILD_SHARE = 0.05, MIN_LOW_DATA_GAMES = 2, MIN_LOW_DATA_SHARE = 0.1;

/** Name of a build as a URL/file-safe id: "Heal & Shield / Tank" -> "heal-and-shield-tank". */
export const archetypeId = (a: BuildArchetype): string => a.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The traits a build name stands for (null = any trait, Well Rounded). Used by the situational noise filter. */
export function labelTraits(label: BuildArchetype): Set<Trait> | null {
  if (label === "Well Rounded") return null;
  if (label === "Hybrid") return new Set<Trait>(["AD", "AP"]);
  return new Set(label.split(" / ").filter((p): p is Trait => (TRAITS as readonly string[]).includes(p)));
}

const sigKey = (g: Signature) => `${g.starter.join(",")}|${g.boots}|${g.core.join(",")}`;
interface Tally { games: number; wins: number }
const tally = (m: Map<string, Tally>, key: string, win: number) => { const t = m.get(key) ?? { games: 0, wins: 0 }; t.games++; t.wins += win; m.set(key, t); };
const topKey = (m: Map<string, Tally>) => [...m].sort((a, b) => b[1].games - a[1].games || (a[0] < b[0] ? -1 : 1))[0];
const ids = (k: string) => (k ? k.split(",").map(Number) : []);

/**
 * Situational items (4th to 6th) of ONE build: counted only in that build's games, never the displayed core, and off-archetype items
 * (a Crit item in an AP build) only when more than 5% of that build's games have them. Ranked by games, then win rate.
 */
export function situationalItems(games: GameBuild[], label: BuildArchetype, coreIds: Set<number>, items: Map<number, ItemMeta>, wpas = new Map<number, BuildItem["wpa"]>()): BuildItem[] {
  const t = new Map<number, Tally>();
  for (const g of games) for (const id of new Set(g.late)) if (!coreIds.has(id) && items.has(id)) { const e = t.get(id) ?? { games: 0, wins: 0 }; e.games++; e.wins += g.win; t.set(id, e); }
  const allowed = labelTraits(label), onArchetype = (id: number) => !allowed || itemKinds(items.get(id)!).kinds.some((k) => allowed.has(k));
  return [...t].filter(([id, e]) => onArchetype(id) || e.games / games.length > SITUATIONAL_OFF_ARCHETYPE_SHARE)
    .sort((a, b) => b[1].games - a[1].games || b[1].wins / b[1].games - a[1].wins / a[1].games || a[0] - b[0]).slice(0, LIMITS.situational)
    .map(([id, e]): BuildItem => ({ id, name: items.get(id)!.name, games: e.games, wins: e.wins, ...(wpas.get(id) ? { wpa: wpas.get(id) } : {}) }));
}

interface Group { label: BuildArchetype; games: GameBuild[] }

/** One build: everything computeBuild gives for the group's own games, with the start, core and order of its most played signature parts and its own situational pool. */
function variantBuild(champion: string, role: Role | null, g: Group, items: Map<number, ItemMeta>): Omit<ChampionBuild, "variants"> {
  const rows = g.games.map((x) => x.row), base = computeBuild(champion, role, rows, items, false);
  const wins = (list: GameBuild[]) => list.reduce((n, x) => n + x.win, 0);
  const star = new Map<string, Tally>(), boot = new Map<string, Tally>(), core = new Map<string, Tally>();
  for (const x of g.games) { if (x.timeline) tally(star, x.startFull.join(","), x.win); if (x.boots) tally(boot, String(x.boots), x.win); tally(core, x.core.join(","), x.win); }
  const coreKey = topKey(core)![0], coreIdList = ids(coreKey), sameCore = g.games.filter((x) => x.core.join(",") === coreKey);
  const corePath: ItemPathStat = { items: coreIdList.map((id) => ({ id, name: items.get(id)!.name, count: 1 })), games: sameCore.length, wins: wins(sameCore) };
  // Build order: the core in its usual order with the most played boots where they are usually bought (the support quest item keeps the slot computeBuild gave it).
  const bootsId = Number(topKey(boot)?.[0] ?? 0), withBoots = sameCore.filter((x) => x.boots === bootsId && x.timeline);
  const at = new Map<string, Tally>(); for (const x of withBoots) tally(at, String(Math.min(x.bootsAt, coreIdList.length)), x.win);
  const order: PathItem[] = coreIdList.map((id) => ({ id, name: items.get(id)!.name, count: 1 }));
  if (bootsId && items.has(bootsId)) order.splice(Number(topKey(at)?.[0] ?? coreIdList.length), 0, { id: bootsId, name: items.get(bootsId)!.name, count: 1 });
  const sup = base.buildOrder?.items.findIndex((i) => isSupportUpgrade(items.get(i.id))) ?? -1;
  if (sup >= 0) order.splice(Math.min(sup, order.length), 0, base.buildOrder!.items[sup]!);
  const buildOrder: ItemPathStat = { items: order, games: sameCore.length, wins: wins(sameCore) };
  // Start: the most played starter set among games with a timeline. No such game: computeBuild's own start (null when it has none).
  const starKey = topKey(star)?.[0], startGames = g.games.filter((x) => x.timeline && x.startFull.join(",") === starKey);
  const counts = new Map<number, number>(); for (const id of ids(starKey ?? "")) counts.set(id, (counts.get(id) ?? 0) + 1);
  const startItems: ItemPathStat | null = starKey ? { items: [...counts].map(([id, c]): PathItem => ({ id, name: items.get(id)!.name, count: c })), games: startGames.length, wins: wins(startGames) } : base.startItems;
  // Items: computeBuild's blocks for the group's games, with the Core block following the chosen order and the Situational block rebuilt from slots 4 to 6 of this build only.
  const blocks = itemBlocks(rows, items, itemWpas(rows, items), coreIdList), shownCore = new Set((blocks.find((b) => b.name === "Core items")?.items ?? []).map((i) => i.id));
  const wpaOf = new Map<number, BuildItem["wpa"]>(blocks.flatMap((b) => b.items).filter((i) => i.wpa).map((i) => [i.id, i.wpa] as const));
  const situational = situationalItems(g.games, g.label, shownCore.size ? shownCore : new Set(coreIdList), items, wpaOf);
  const rank = (n: string) => ["Support item", "Boots", "Core items", "Situational"].indexOf(n);
  const itemBlocksOut = [...blocks.filter((b) => b.name !== "Situational"), ...(situational.length ? [{ name: "Situational", items: situational }] : [])].sort((a, b) => rank(a.name) - rank(b.name));
  return { ...base, itemBlocks: itemBlocksOut, startItems, corePath, buildOrder };
}

/**
 * The builds of a champion (one role, your filters): signatures -> names -> roll-up by name, most played first, at least ONE whenever any game has a finished item.
 * - Only games with a full core (3 finished items) count when there are MIN_COMPLETE_GAMES of them; otherwise all games with at least one finished item.
 * - 1% noise rule: with ABUNDANT_GAMES or more such games, signatures under 1% are dropped, unless that would drop more than half of the games (ordered 5-item
 *   signatures are sparse); with fewer games every signature is kept and still named.
 * - A build needs MIN_BUILD_GAMES games and MIN_BUILD_SHARE of the games (low-data mode: MIN_LOW_DATA_GAMES and MIN_LOW_DATA_SHARE); the most played build always stays. At most MAX_VARIANTS.
 */
export function buildVariants(champion: string, role: Role | null, rows: BuildRow[], items: Map<number, ItemMeta>): BuildVariant[] {
  const extracted = rows.map((r) => extractGame(r, items)).filter((g): g is GameBuild => !!g);
  if (!extracted.length) return [];
  const full = extracted.filter((g) => g.core.length >= 3), fullMode = full.length >= MIN_COMPLETE_GAMES, all = fullMode ? full : extracted;
  const counts = new Map<string, number>(); for (const g of all) counts.set(sigKey(g), (counts.get(sigKey(g)) ?? 0) + 1);
  const abundant = all.length >= ABUNDANT_GAMES, kept = abundant ? all.filter((g) => counts.get(sigKey(g))! / all.length >= NOISE_SHARE) : all;
  const used = abundant && kept.length >= all.length / 2 ? kept : all;
  const names = new Map<string, BuildArchetype>(), groups = new Map<BuildArchetype, Group>();
  for (const g of used) {
    const key = sigKey(g); let label = names.get(key); if (!label) { label = classifySignature(g, items); names.set(key, label); }
    (groups.get(label) ?? groups.set(label, { label, games: [] }).get(label)!).games.push(g);
  }
  const need = fullMode ? Math.max(MIN_BUILD_GAMES, Math.ceil(used.length * MIN_BUILD_SHARE)) : Math.max(MIN_LOW_DATA_GAMES, Math.ceil(used.length * MIN_LOW_DATA_SHARE));
  const top = [...groups.values()].sort((a, b) => b.games.length - a.games.length || (a.label < b.label ? -1 : 1)).filter((g, i) => i === 0 || g.games.length >= need).slice(0, MAX_VARIANTS);
  return top.map((g) => ({ id: archetypeId(g.label), label: g.label, games: g.games.length, wins: g.games.reduce((n, x) => n + x.win, 0), build: variantBuild(champion, role, g, items) }));
}

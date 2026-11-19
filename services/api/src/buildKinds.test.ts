import { describe, expect, it } from "vitest";
import { MIXED_ARCHETYPES, PURE_ARCHETYPES } from "@apex/schema";
import type { BuildRow, ItemMeta } from "./build";
import { buildVariants, buildVector, classifySignature, extractGame, situationalItems, type GameBuild } from "./buildKinds";

const fin = (name: string, stats: string[]): ItemMeta => ({ name, total: 3000, hasUpgrade: false, stats });
const items = new Map<number, ItemMeta>([
  [1, fin("Test AD", ["ad"])], [2, fin("Test AP", ["ap"])], [3, fin("Test AP 2", ["ap"])], [4, fin("Test AD 2", ["ad"])], [5, fin("Test AD 3", ["ad"])],
  [10, fin("Kraken Slayer", [])], [11, fin("Blade of the Ruined King", [])], [12, fin("Terminus", [])], [13, fin("Nashor's Tooth", [])], [14, fin("Guinsoo's Rageblade", [])],
  [20, fin("Infinity Edge", ["crit", "ad"])], [21, fin("Banshee's Veil", ["ap", "mr"])], [60, fin("Test AP 3", ["ap"])], [61, fin("Test AD 4", ["ad"])],
  [30, { name: "Sorcerer's Shoes", total: 1100, hasUpgrade: false, boots: true }], [31, { name: "Plated Steelcaps", total: 1200, hasUpgrade: false, boots: true }],
  [40, { name: "Doran's Blade", total: 450, hasUpgrade: true }], [41, { name: "Health Potion", total: 50, hasUpgrade: false, tags: ["Consumable"] }], [42, { name: "Stealth Ward", total: 0, hasUpgrade: false, tags: ["Trinket"] }],
  [50, { name: "Component", total: 1000, hasUpgrade: true }], [99, fin("Plain Item", [])],
]);
const row = (buys: number[], win = 1, start: number[] = [40]): BuildRow => ({ perks: null, items: JSON.stringify(buys.filter((id) => id !== 50)), spell1: 4, spell2: 14, win, start: JSON.stringify(start), buys: JSON.stringify(buys) });
const sig = (core: number[], boots = 0, starter: number[] = []) => ({ core, boots, starter });

describe("extractGame (the four buckets)", () => {
  it("starter without consumables and trinkets, first tier 2 boots, core 3 in purchase order, late items after the core", () => {
    const g = extractGame(row([50, 1, 30, 2, 3, 31, 21, 20], 1, [40, 41, 42]), items)!;
    expect(g.starter).toEqual([40]); expect(g.boots).toBe(30); expect(g.core).toEqual([1, 2, 3]); expect(g.late).toEqual([21, 20]); expect(g.bootsAt).toBe(1);
  });
  it("the start shown on the page keeps potions with their count; only the grouping key drops them", () => {
    const g = extractGame(row([2, 3, 21], 1, [40, 41, 41, 42]), items)!;
    expect(g.startFull).toEqual([40, 41, 41]); expect(g.starter).toEqual([40]);
    const v = buildVariants("Ahri", "MID", Array.from({ length: 40 }, () => row([2, 3, 21], 1, [40, 41, 41])), items)[0]!;
    expect(v.build.startItems!.items).toEqual([{ id: 40, name: "Doran's Blade", count: 1 }, { id: 41, name: "Health Potion", count: 2 }]);
  });
  it("a game with 1 or 2 finished items is still extracted; a game with none is not", () => {
    expect(extractGame(row([50, 1]), items)!.core).toEqual([1]);
    expect(extractGame(row([50, 30]), items)).toBeNull();
  });
});

describe("weights", () => {
  it("core 1.5 / 1.2 / 1.0, offensive boots 0.4 and a directional starter 0.2 count", () => {
    const v = buildVector(sig([2, 3, 1], 30, [40]), items).combined;
    expect(v.AP).toBeCloseTo(1.5 + 1.2 + 0.4); expect(v.AD).toBeCloseTo(1.0 + 0.2);
  });
  it("defensive boots and non-directional starters count 0", () => {
    const v = buildVector(sig([2, 3, 1], 31, [41]), items).combined;
    expect(v.AP).toBeCloseTo(2.7); expect(v.AD).toBeCloseTo(1.0); expect(v.Tank).toBe(0);
  });
});

describe("label funnel", () => {
  it("one trait with 60% or more names the build", () => expect(classifySignature(sig([2, 3, 21]), items)).toBe("AP"));
  it("hard overrides: two AD on-hit items, Nashor's with another on-hit item", () => {
    expect(classifySignature(sig([10, 11, 12]), items)).toBe("On-Hit / AD");
    expect(classifySignature(sig([13, 14, 2]), items)).toBe("On-Hit / AP");
  });
  it("mixed AD and AP scaling (no trait at 60%) is the closest name: Hybrid", () => expect(classifySignature(sig([1, 2, 3]), items)).toBe("Hybrid"));
  it("always resolves to one of the existing names, also with 1 item or items nobody has stats for", () => {
    const names = new Set<string>([...PURE_ARCHETYPES, ...MIXED_ARCHETYPES]);
    for (const core of [[1], [99], [2, 20], [20, 4], [1, 2], [21, 5, 10], [99, 99, 99]]) expect(names.has(classifySignature(sig(core), items))).toBe(true);
    expect(classifySignature(sig([99]), items)).toBe("Well Rounded");
  });
});

describe("buildVariants", () => {
  const ap = (i: number) => row(i % 2 ? [2, 30, 3, 21] : [3, 2, 31, 21], 1);
  it("rolls signatures that differ in boots and order up under one build name", () => {
    const v = buildVariants("Ahri", "MID", Array.from({ length: 30 }, (_, i) => ap(i)), items);
    expect(v).toHaveLength(1); expect(v[0]).toMatchObject({ label: "AP", games: 30, id: "ap" });
    expect(v[0]!.build.corePath!.items.length).toBe(3); expect(v[0]!.build.buildOrder!.items.length).toBe(4);   // 3 core items + the usual boots
  });
  it("with very little data (1 game, 1 finished item) there is still one named build, never a generic one", () => {
    const v = buildVariants("Ahri", "MID", [row([50, 2])], items);
    expect(v).toHaveLength(1); expect(v[0]!.label).toBe("AP");
  });
  it("games that ended with fewer than 3 finished items never form a build once there are enough full-core games", () => {
    const full = Array.from({ length: 100 }, () => row([2, 3, 21], 1)), shortGames = Array.from({ length: 40 }, () => row([30, 1], 0));   // an early surrender with a single AD item
    const v = buildVariants("Vayne", "ADC", [...full, ...shortGames], items);
    expect(v.map((x) => x.label)).toEqual(["AP"]); expect(v[0]!.games).toBe(100); expect(v[0]!.build.corePath!.items).toHaveLength(3);
  });
  it("a build under 50 games or 5% of the games is not shown next to a big one, the most played one always is", () => {
    const big = Array.from({ length: 120 }, () => row([2, 3, 21], 1)), small = Array.from({ length: 30 }, () => row([1, 4, 5], 0));
    expect(buildVariants("Ahri", "MID", [...big, ...small], items).map((x) => x.label)).toEqual(["AP"]);
    expect(buildVariants("Ahri", "MID", small, items).map((x) => x.label)).toEqual(["AD"]);   // few games: the one build stays
  });
  it("with few full-core games (new patch) partial games still get a name, and a tiny one-game build is not listed next to the main one", () => {
    const v = buildVariants("Ahri", "MID", [...Array.from({ length: 12 }, () => row([2, 3], 1)), row([1], 0)], items);
    expect(v.map((x) => x.label)).toEqual(["AP"]);
  });
  it("games without any finished item give no build", () => expect(buildVariants("Ahri", "MID", [row([50, 30])], items)).toEqual([]));
  it("situational items are pooled per build, never from another build, and never include the core", () => {
    const apGames = Array.from({ length: 60 }, () => row([2, 3, 21, 60], 1)), adGames = Array.from({ length: 60 }, () => row([1, 4, 5, 61], 0));
    const v = buildVariants("Ahri", "MID", [...apGames, ...adGames], items), byLabel = (l: string) => v.find((x) => x.label === l)!;
    const sit = (l: string) => byLabel(l).build.itemBlocks.find((b) => b.name === "Situational")?.items.map((i) => i.id) ?? [];
    expect(v.map((x) => x.label).sort()).toEqual(["AD", "AP"]);
    expect(sit("AP")).toEqual([60]); expect(sit("AD")).toEqual([61]);   // each build only sees its own games: no 61 in the AP build, no 60 in the AD build
  });
});

describe("situationalItems (4th to 6th, per build)", () => {
  const g = (late: number[], win = 1): GameBuild => ({ ...extractGame(row([2, 3, 21, ...late], win), items)! });
  const games = (n: number, lateOf: (i: number) => number[]) => Array.from({ length: n }, (_, i) => g(lateOf(i)));
  it("ranks by games and leaves out items of the displayed core", () => {
    const g20 = games(20, (i) => (i < 15 ? [60] : [99]));
    expect(situationalItems(g20, "AP", new Set([2, 3, 21]), items).map((i) => i.id)).toEqual([60, 99]);
    expect(situationalItems(g20, "AP", new Set([2, 3, 21, 60]), items).map((i) => i.id)).toEqual([99]);
  });
  it("an off-archetype item (Crit in an AP build) needs more than 5% of the build's games", () => {
    const under = situationalItems(games(40, (i) => (i < 2 ? [60, 20] : [60])), "AP", new Set([2, 3, 21]), items);   // 5%: not above
    const over = situationalItems(games(40, (i) => (i < 4 ? [60, 20] : [60])), "AP", new Set([2, 3, 21]), items);    // 10%
    expect(under.map((i) => i.id)).toEqual([60]); expect(over.map((i) => i.id)).toEqual([60, 20]);
  });
});

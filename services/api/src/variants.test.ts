import { describe, expect, it } from "vitest";
import { archetype, buildOrder, buildVariants, computeBuild, MAX_VARIANTS, MIN_BOOTS_SHARE, MIN_VARIANT_GAMES, skillGrid, skillOrder, spellPairs, type BuildRow, type ItemMeta } from "./build";

const it_ = (name: string, total: number, tags: string[], extra: Partial<ItemMeta> = {}): ItemMeta => ({ name, total, hasUpgrade: false, tags, ...extra });
const items = new Map<number, ItemMeta>([
  [3157, it_("Zhonya", 3250, ["SpellDamage", "Armor"])], [3089, it_("Rabadon", 3600, ["SpellDamage"])], [3100, it_("Lich Bane", 3000, ["SpellDamage", "Boots-no"])],
  [3071, it_("Black Cleaver", 3000, ["Damage", "Health"])], [3031, it_("Infinity Edge", 3400, ["Damage", "CriticalStrike"])], [3036, it_("Lord Dominik's", 3000, ["Damage", "ArmorPenetration"])],
  [3068, it_("Sunfire", 2700, ["Armor", "Health"])], [3075, it_("Thornmail", 2700, ["Armor"])], [3083, it_("Warmog's", 3000, ["Health"])], [3065, it_("Spirit Visage", 2900, ["SpellBlock", "Health"])],
  [3020, it_("Sorcerer's Shoes", 1100, [], { boots: true, hasUpgrade: true })], [3047, it_("Plated Steelcaps", 1100, ["Armor", "Boots"], { boots: true, hasUpgrade: true })],
  [1055, it_("Doran's Blade", 450, ["Damage"], { hasUpgrade: true })],
]);
const row = (inv: number[], win = 1, over: Partial<BuildRow> = {}): BuildRow => ({ perks: null, items: JSON.stringify(inv), spell1: 4, spell2: 14, win, ...over });
const many = (n: number, make: (i: number) => BuildRow) => Array.from({ length: n }, (_, i) => make(i));

describe("archetype", () => {
  it("counts SpellDamage as AP, Damage / CriticalStrike as AD, and defensive-only items as Tank", () => {
    expect(archetype([3157, 3089, 3100], items)).toBe("AP");
    expect(archetype([3071, 3031, 3036], items)).toBe("AD");
    expect(archetype([3068, 3075, 3083, 3065], items)).toBe("Tank");
  });
  it("an item with a damage tag never counts as Tank (Black Cleaver has Health), and the largest group wins", () => {
    expect(archetype([3071, 3068, 3075, 3083], items)).toBe("Tank");      // 1 AD vs 3 Tank
    expect(archetype([3071, 3031, 3068, 3075], items)).toBe("AD");        // 2 AD vs 2 Tank: tie goes to AD before Tank
  });
  it("ties go to AP first", () => expect(archetype([3157, 3089, 3071, 3031], items)).toBe("AP"));
  it("ignores boots, components, duplicates and unknown items, and needs 3 counted items", () => {
    expect(archetype([3157, 3089, 3020, 1055, 9999], items)).toBeNull();
    expect(archetype([3157, 3157, 3157, 3089], items)).toBeNull();        // a duplicate counts once: 2 items
    expect(archetype([], items)).toBeNull();
  });
  it("without tags nothing is classified", () => expect(archetype([3157, 3089, 3100], new Map([[3157, { name: "a", total: 3000, hasUpgrade: false }], [3089, { name: "b", total: 3000, hasUpgrade: false }], [3100, { name: "c", total: 3000, hasUpgrade: false }]]))).toBeNull());
});

describe("buildVariants", () => {
  const ap = (n: number, win = 1) => many(n, () => row([3157, 3089, 3100, 3020], win)), tank = (n: number, win = 0) => many(n, () => row([3068, 3075, 3083, 3047], win));
  it("returns one complete build per kind, most played first, each from its own games only", () => {
    const v = buildVariants("Nunu", null, [...ap(30), ...tank(12)], items);
    expect(v.map((x) => [x.id, x.games])).toEqual([["AP", 30], ["Tank", 12]]);
    expect(v[1]).toMatchObject({ label: "Tank", wins: 0 });
    expect(v[0].build.games).toBe(30);
    expect(v[1].build.itemBlocks.flatMap((b) => b.items.map((i) => i.id))).toEqual(expect.arrayContaining([3068]));
    expect(v[1].build.itemBlocks.flatMap((b) => b.items.map((i) => i.id))).not.toContain(3157);
    expect((v[0].build as { variants?: unknown }).variants).toBeUndefined();   // no nesting
  });
  it("is empty with a single kind (that is just \"the build\")", () => expect(buildVariants("Ahri", null, ap(40), items)).toEqual([]));
  it("drops a kind with too few games, in absolute terms and as a share of the classified games", () => {
    expect(buildVariants("Nunu", null, [...ap(50), ...tank(MIN_VARIANT_GAMES - 1)], items)).toEqual([]);
    expect(buildVariants("Nunu", null, [...ap(300), ...tank(12)], items)).toEqual([]);          // 12 is under 5% of 312
    expect(buildVariants("Nunu", null, [...ap(100), ...tank(15)], items)).toHaveLength(2);
  });
  it("keeps at most MAX_VARIANTS", () => {
    const ad = many(20, () => row([3071, 3031, 3036, 3047]));
    expect(MAX_VARIANTS).toBe(3);
    expect(buildVariants("X", null, [...ap(30), ...tank(25), ...ad], items).map((v) => v.id)).toEqual(["AP", "Tank", "AD"]);
  });
  it("games that cannot be classified (short games, no tags) stay out of the variants but not out of the main build", () => {
    const rows = [...ap(20), ...tank(15), ...many(5, () => row([3157, 3020]))];
    const b = computeBuild("Nunu", null, rows, items);
    expect(b.games).toBe(40);
    expect(b.variants?.map((v) => v.games)).toEqual([20, 15]);
  });
  it("computeBuild leaves variants out when there are none", () => expect("variants" in computeBuild("Ahri", null, ap(40), items)).toBe(false));
});

describe("skillGrid", () => {
  const first9 = "QWEQQRQEQ".split("");
  it("always has 18 entries, keeps the real first 9, puts R at 11 and 16 and never exceeds rank 5 (R: 3)", () => {
    const g = skillGrid(first9, ["Q", "E", "W"]);
    expect(g).toHaveLength(18); expect(g.slice(0, 9)).toEqual(first9);
    expect(g[10]).toBe("R"); expect(g[15]).toBe("R");
    for (const k of ["Q", "W", "E"]) expect(g.filter((x) => x === k)).toHaveLength(5);
    expect(g.filter((x) => x === "R")).toHaveLength(3);
  });
  it("follows the max order after the first 9 (Q was already maxed, so E comes next)", () => expect(skillGrid(first9, ["Q", "E", "W"]).slice(9, 12)).toEqual(["E", "R", "E"]));
  it("is still 18 long with odd input (R taken early or too few levels)", () => {
    expect(skillGrid("RRRQWEQQQ".split(""), ["Q", "W", "E"])).toHaveLength(18);
    expect(skillGrid("QWE".split(""), ["W", "Q", "E"])).toHaveLength(18);
  });
  it("is part of the skill order stat", () => {
    const sk = (a: number[]) => ({ ...row([]), skills: JSON.stringify(a) });
    const s = skillOrder(many(10, () => sk([1, 2, 3, 1, 1, 4, 1, 3, 1, 3, 4, 3, 2, 2, 2, 4, 2, 3])), 1)!;
    expect(s.grid).toHaveLength(18); expect(s.grid!.slice(0, 9).join("")).toBe(s.levels.join(""));
  });
});

describe("spellPairs", () => {
  it("returns the two most played pairs with Flash second", () => {
    const rows = [...many(5, () => row([], 1, { spell1: 4, spell2: 14 })), ...many(3, () => row([], 0, { spell1: 11, spell2: 4 })), row([], 1, { spell1: 3, spell2: 4 })];
    expect(spellPairs(rows).map((p) => [p.ids, p.games])).toEqual([[[14, 4], 5], [[11, 4], 3]]);
    expect(spellPairs(rows, 1)).toHaveLength(1);
  });
  it("is empty without spells", () => expect(spellPairs([row([], 1, { spell1: null, spell2: null })])).toEqual([]));
});

describe("buildOrder (core items and boots in the order they are bought)", () => {
  const game = (buys: number[], keep: number[] = buys) => row(keep, 1, { buys: JSON.stringify(buys) });
  it("puts the boots where they usually are bought among the core items", () => {
    const b = buildOrder(many(12, () => game([3100, 3020, 3157, 3089])), items)!;
    expect(b.items.map((i) => i.id)).toEqual([3100, 3020, 3157, 3089]);
    expect(b.games).toBe(12);
  });
  it("boots first when they are bought first", () => expect(buildOrder(many(12, () => game([3020, 3100, 3157, 3089])), items)!.items.map((i) => i.id)[0]).toBe(3020));
  it("leaves boots out when under the share of games had them", () => {
    const some = many(12, (i) => (i < 4 ? game([3100, 3157, 3089, 3020]) : game([3100, 3157, 3089])));  // 4 of 12 = 33%
    expect(4 / 12).toBeLessThan(MIN_BOOTS_SHARE);
    expect(buildOrder(some, items)!.items.map((i) => i.id)).toEqual([3100, 3157, 3089]);
  });
  it("ignores boots that were sold (not in the final inventory)", () => expect(buildOrder(many(12, () => game([3020, 3100, 3157, 3089], [3100, 3157, 3089])), items)!.items.map((i) => i.id)).toEqual([3100, 3157, 3089]));
  const withSwift = new Map<number, ItemMeta>([...items, [3009, it_("Boots of Swiftness", 1000, ["Boots"], { boots: true, hasUpgrade: true })]]);
  it("keeps a boots slot when players split between several kinds of boots (the slot shows the most common one)", () => {
    const kinds = [3020, 3047, 3009];                                   // 4 games each: no single kind reaches 40%, but every game has boots
    const b = buildOrder(many(12, (i) => game([3100, kinds[i % 3], 3157, 3089])), withSwift)!;
    expect(b.items).toHaveLength(4); expect(b.items.map((x) => x.id)).toEqual([3100, 3009, 3157, 3089]);   // tie: the lowest id wins, so the order is stable
  });
  it("the slot takes the most common boots, and the boots count once even when the kinds differ", () => {
    const b = buildOrder(many(12, (i) => game([3100, i < 8 ? 3047 : 3020, 3157, 3089])), items)!;
    expect(b.items.map((x) => x.id)).toEqual([3100, 3047, 3157, 3089]);
    expect(b.items.filter((x) => items.get(x.id)?.boots)).toHaveLength(1);
  });
  it("places the boots at their average position (here mostly bought last)", () => {
    const b = buildOrder(many(12, (i) => game(i < 10 ? [3100, 3157, 3089, 3020] : [3020, 3100, 3157, 3089])), items)!;
    expect(b.items.map((x) => x.id)).toEqual([3100, 3157, 3089, 3020]);
  });
  it("games without boots do not count toward the slot, but need 40% of games to have boots", () => {
    const some = many(12, (i) => (i < 5 ? game([3100, 3020, 3157, 3089]) : game([3100, 3157, 3089])));   // 5 of 12 = 42%
    expect(buildOrder(some, items)!.items).toHaveLength(4);
  });
  it("is null without a core path (too few games)", () => expect(buildOrder(many(3, () => game([3100, 3157, 3089])), items)).toBeNull());
  it("is part of computeBuild", () => expect(computeBuild("Ahri", null, many(12, () => game([3100, 3020, 3157, 3089])), items).buildOrder?.items).toHaveLength(4));
});

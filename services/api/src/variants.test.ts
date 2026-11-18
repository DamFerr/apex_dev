import { describe, expect, it } from "vitest";
import { PURE_ARCHETYPES } from "@apex/schema";
import { itemStats } from "./ddragon";
import { ITEM_KIND_OVERRIDES, archetype, archetypeId, itemKinds, keptItems, buildOrder, buildVariants, computeBuild, MAX_VARIANTS, MIN_BOOTS_SHARE, MIN_VARIANT_GAMES, skillGrid, skillOrder, spellPairs, type BuildRow, type ItemMeta } from "./build";

const it_ = (name: string, total: number, tags: string[], extra: Partial<ItemMeta> = {}): ItemMeta => ({ name, total, hasUpgrade: false, tags, ...extra });
const items = new Map<number, ItemMeta>([
  [3157, it_("Zhonya", 3250, ["SpellDamage", "Armor"])], [3089, it_("Rabadon", 3600, ["SpellDamage"])], [3100, it_("Lich Bane", 3000, ["SpellDamage", "Boots-no"])],
  [3071, it_("Black Cleaver", 3000, ["Damage", "Health"])], [3031, it_("Infinity Edge", 3400, ["Damage", "CriticalStrike"])], [3036, it_("Lord Dominik's", 3000, ["Damage", "ArmorPenetration"])],
  [3068, it_("Sunfire", 2700, ["Armor", "Health"])], [3075, it_("Thornmail", 2700, ["Armor"])], [3083, it_("Warmog's", 3000, ["Health"])], [3065, it_("Spirit Visage", 2900, ["SpellBlock", "Health"])],
  [3020, it_("Sorcerer's Shoes", 1100, [], { boots: true, hasUpgrade: true })], [3047, it_("Plated Steelcaps", 1100, ["Armor", "Boots"], { boots: true, hasUpgrade: true })],
  [1055, it_("Doran's Blade", 450, ["Damage"], { hasUpgrade: true })],
  [3501, it_("Plain AD 1", 3000, ["Damage"])], [3502, it_("Plain AD 2", 3000, ["Damage"])],
]);
const row = (inv: number[], win = 1, over: Partial<BuildRow> = {}): BuildRow => ({ perks: null, items: JSON.stringify(inv), spell1: 4, spell2: 14, win, ...over });
const many = (n: number, make: (i: number) => BuildRow) => Array.from({ length: n }, (_, i) => make(i));

describe("archetype", () => {
  // Items for the kinds, described by what Data Dragon's stat block says (`stats`) and its tags. Ids 9001 and up are made up.
  const k = (name: string, stats: string[], tags: string[] = []) => it_(name, 3000, tags, { stats });
  const kit = new Map<number, ItemMeta>([...items,
    [9001, k("Collector", ["ad", "crit", "leth"])], [9002, k("Hubris", ["ad", "leth"])], [9003, k("Opportunity", ["ad", "leth"])], [9004, k("Moonstone", ["ap", "hsp"])], [9005, k("Redemption", ["hp", "hsp"])],
    [9006, k("Kraken Slayer", ["ad", "as", "onhit"])], [9007, k("Guinsoo's", ["ap", "as", "onhit"])], [9008, k("Yun Tal", ["ad", "crit", "as"])], [9009, k("Phantom Dancer", ["crit", "as"])],
    [9010, k("Riftmaker", ["ap", "hp"])], [9011, k("Liandry's", ["ap", "hp"])], [9012, k("Heartsteel", ["hp"])], [9013, k("Sundered Sky", ["ad", "hp"])], [9014, k("Death's Dance", ["ad", "armor"])],
    [9015, k("Locket", ["armor", "mr", "active"])], [9016, k("Zeke's", ["armor", "mr", "active"])], [9017, k("Mikael's", ["hp", "hsp", "active"])], [9018, k("Ardent", ["ap", "hsp"])],
    [9019, k("Shurelya's", ["ap", "active"], ["Active"])], [9020, k("Eclipse", ["ad"])], [9021, k("Serylda's", ["ad", "arpen"])], [9022, k("Redirect", [], ["Aura"])], [9023, k("Zhonya", ["ap", "armor"])],
  ]);
  const kind = (...ids: number[]) => archetype(ids, kit);
  it("the pure kinds", () => {
    expect(kind(3157, 3089, 3100)).toBe("AP");                   // Zhonya's / Rabadon / Lich Bane: all AP
    expect(kind(9020, 9020 + 0, 9021)).toBeNull();               // a duplicate counts once: 2 items
    expect(kind(9020, 9021, 3071 + 0)).not.toBeNull();
    expect(kind(9013, 9014, 3071)).toBe("Bruiser");              // AD plus Health or defence
    expect(kind(9009, 3031, 9008)).toBe("Crit");
    expect(kind(9002, 9003, 3036)).toBe("Lethality");
    expect(kind(9004, 9018, 9005)).toBe("Heal & Shield");
    expect(kind(9007, 9006, 9007 + 0, 9008 + 0)).not.toBe("Tank");
    expect(kind(3068, 3075, 3083, 3065)).toBe("Tank");
    expect(kind(9022, 9019, 9017 + 100)).toBeNull();             // an unknown item is not an item
  });
  it("On-Hit, Utility and Well Rounded", () => {
    expect(kind(9006, 9007, 9006 + 0, 9007 + 0)).toBeNull();     // two distinct items only
    const more = new Map(kit).set(9030, k("Wit's End", ["as", "mr", "onhit"])).set(9031, k("Nashor's", ["ap", "as", "onhit"]));
    expect(archetype([9007, 9030, 9031], more)).toBe("On-Hit / AP");   // Guinsoo + Nashor (on-hit with AP) + Wit's End
    const plain = new Map(more).set(9035, k("Terminus", ["as", "onhit"]));
    expect(archetype([9030, 9035, 9007], plain)).toBe("On-Hit");     // on-hit items with at most one AP item stay plain On-Hit
    expect(archetype([9022 + 0, 9019, 9015 + 100], more)).toBeNull();
    const util = new Map(kit).set(9032, k("Banner", [], ["Aura"])).set(9033, k("Chemtech", [], ["Active"])).set(9034, k("Shield", [], ["Aura", "Slow"]));
    expect(archetype([9032, 9033, 9034], util)).toBe("Utility");
    expect(kind(3157, 9014, 9009, 9012, 9017)).toBe("Well Rounded");   // five items, no kind covers half of them
  });
  it("Hybrid needs two AD and two AP items", () => {
    expect(kind(3157, 3089, 3071, 3031)).toBe("Hybrid");
    expect(kind(3157, 3071, 9020, 9021)).not.toBe("Hybrid");     // only one AP item
  });
  it("the nine named mixes, when both kinds have two items", () => {
    expect(kind(9010, 9011, 3089, 3068)).toBe("AP / Bruiser");   // Riftmaker and Liandry's count as AP and Bruiser
    expect(kind(9013, 9014, 9002, 9003)).toBe("Bruiser / Lethality");
    expect(kind(9013, 9014, 9012, 3068)).toBe("Bruiser / Tank");
    expect(kind(9001, 9009, 9002, 9003)).toBe("Crit / Lethality"); // Collector counts as Crit and Lethality
        expect(kind(9015, 9005, 9017, 3068)).toBe("Heal & Shield / Tank");
    expect(kind(9015, 9016, 3083, 9022)).toBe("Tank / Utility");
  });
  it("mixes with On-Hit and Utility", () => {
    const m = new Map(kit).set(9040, k("Blade", ["ad", "as", "onhit"])).set(9041, k("Blade Two", ["ad", "as", "onhit"])).set(9042, k("Dancer", ["crit", "as"])).set(9043, k("Edge", ["ad", "crit", "as", "onhit"]));
    expect(archetype([9040, 9041, 9020, 9008], m)).toBe("On-Hit / AD");
    expect(archetype([9040, 9041, 9043, 9042], m)).toBe("On-Hit / Crit");   // On-Hit has more items, so it goes first
    expect(archetype([9043, 9008, 9042, 9040], m)).toBe("Crit / On-Hit");
    expect(kind(9015, 9016, 9017 + 0, 3083)).toBe("Tank / Utility");
  });
  it("Hybrid needs really mixed scaling: two or more of each side, and the smaller side at least two thirds of the larger", () => {
    expect(kind(3157, 3089, 3071, 3031)).toBe("Hybrid");                       // 2 AP + 2 AD
    expect(kind(3157, 3089, 3100, 3071, 9020, 9021)).toBe("Hybrid");           // 3 AP + 3 AD
    expect(kind(3157, 3089, 3071)).not.toBe("Hybrid");                          // 2 AP + 1 AD: an AP build
    const apHeavy = new Map(kit).set(9050, k("Void", ["ap"])).set(9051, k("Luden", ["ap"]));
    expect(archetype([3157, 3089, 3100, 9050, 3071, 3031], apHeavy)).toBe("AP");  // 4 AP + 2 AD: almost full AP, not Hybrid
  });
  it("ignores boots, components and unknown items, and needs 3 counted items", () => {
    expect(kind(3157, 3089, 3020, 1055, 9999)).toBeNull();
    expect(kind(3157, 3157, 3157, 3089)).toBeNull();
    expect(kind()).toBeNull();
  });
  it("without stats or tags nothing is classified", () => expect(archetype([3157, 3089, 3100], new Map([[3157, { name: "a", total: 3000, hasUpgrade: false }], [3089, { name: "b", total: 3000, hasUpgrade: false }], [3100, { name: "c", total: 3000, hasUpgrade: false }]]))).toBeNull());
  it("archetypeId makes a file-safe id", () => { expect(archetypeId("Heal & Shield / Tank")).toBe("heal-and-shield-tank"); expect(archetypeId("AP")).toBe("ap"); });
});

describe("buildVariants", () => {
  const ap = (n: number, win = 1) => many(n, () => row([3157, 3089, 3100, 3020], win)), tank = (n: number, win = 0) => many(n, () => row([3068, 3075, 3083, 3047], win));
  it("returns one complete build per kind, most played first, each from its own games only", () => {
    const v = buildVariants("Nunu", null, [...ap(30), ...tank(12)], items);
    expect(v.map((x) => [x.id, x.games])).toEqual([["ap", 30], ["tank", 12]]);
    expect(v[1]).toMatchObject({ label: "Tank", wins: 0 });
    expect(v[0].build.games).toBe(30);
    expect(v[1].build.itemBlocks.flatMap((b) => b.items.map((i) => i.id))).toEqual(expect.arrayContaining([3068]));
    expect(v[1].build.itemBlocks.flatMap((b) => b.items.map((i) => i.id))).not.toContain(3157);
    expect((v[0].build as { variants?: unknown }).variants).toBeUndefined();   // no nesting
  });
  it("is empty with a single kind (that is just \"the build\")", () => expect(buildVariants("Ahri", null, ap(40), items)).toEqual([]));
  it("drops a kind with too few games, in absolute terms and as a share of the classified games", () => {
    expect(buildVariants("Nunu", null, [...ap(50), ...tank(MIN_VARIANT_GAMES - 1)], items)).toEqual([]);
    expect(buildVariants("Nunu", null, [...ap(600), ...tank(12)], items)).toEqual([]);          // 12 is under 2.5% of 612
    expect(buildVariants("Nunu", null, [...ap(100), ...tank(15)], items)).toHaveLength(2);
  });
  it("keeps at most MAX_VARIANTS", () => {
    const ad = many(20, () => row([3071, 3071 + 1, 3036 + 1, 3047].map((x) => x === 3072 ? 3501 : x === 3037 ? 3502 : x)));
    expect(MAX_VARIANTS).toBe(4);
    expect(buildVariants("X", null, [...ap(30), ...tank(25), ...ad], items).map((v) => v.id)).toEqual(["ap", "tank", "ad"]);
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
    const some = many(12, (i) => (i < 2 ? game([3100, 3157, 3089, 3020]) : game([3100, 3157, 3089])));  // 2 of 12 = 17%
    expect(2 / 12).toBeLessThan(MIN_BOOTS_SHARE);
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
  it("games without boots do not count toward the slot, but 20% of the games must have boots", () => {
    const some = many(12, (i) => (i < 5 ? game([3100, 3020, 3157, 3089]) : game([3100, 3157, 3089])));   // 5 of 12 = 42%
    expect(buildOrder(some, items)!.items).toHaveLength(4);
    const fewer = many(10, (i) => (i < 3 ? game([3100, 3020, 3157, 3089]) : game([3100, 3157, 3089])));   // 3 of 10 = 30%: the usual boots are in the order (they used to need 40%)
    expect(buildOrder(fewer, items)!.items.map((x) => x.id)).toEqual([3100, 3020, 3157, 3089]);
  });
  it("finds the usual boots from the final inventory even when the timeline never shows them bought (Veigar case), in 2nd place", () => {
    const g = (i: number) => row([3100, 3157, 3089, i < 9 ? 3020 : 3047], 1, { buys: JSON.stringify([3100, 3157, 3089]) });   // boots only in the final inventory
    const b = buildOrder(many(12, g), items)!;
    expect(b.items.map((x) => x.id)).toEqual([3100, 3020, 3157, 3089]);                     // the most common boots (9 of 12), second
  });
  it("shows only ONE boots item in the order, so the other kinds are left for the options block, in every variant", () => {
    const ap = (n: number) => many(n, (i) => row([3157, 3089, 3100, i % 4 ? 3020 : 3047], 1, { buys: JSON.stringify([3100, 3157, 3089]) }));
    const tank = (n: number) => many(n, (i) => row([3068, 3075, 3083, i % 4 ? 3047 : 3020], 0, { buys: JSON.stringify([3068, 3075, 3083]) }));
    const v = buildVariants("Veigar", null, [...ap(40), ...tank(40)], items);
    expect(v.map((x) => x.id).sort()).toEqual(["ap", "tank"]);
    for (const x of v) {
      const boots = x.build.buildOrder!.items.filter((i) => items.get(i.id)?.boots);
      expect(boots).toHaveLength(1);                                                          // the best boots are in the order ...
      const options = x.build.itemBlocks.find((b) => b.name === "Boots")!.items.map((i) => i.id);
      expect(options).toContain(boots[0].id === 3020 ? 3047 : 3020);                         // ... the others are in the Boots block (the page drops the one already in the order)
    }
    expect(v.find((x) => x.id === "ap")!.build.buildOrder!.items.some((i) => i.id === 3020)).toBe(true);
    expect(v.find((x) => x.id === "tank")!.build.buildOrder!.items.some((i) => i.id === 3047)).toBe(true);
  });
  it("is null without a core path (too few games)", () => expect(buildOrder(many(3, () => game([3100, 3157, 3089])), items)).toBeNull());
  it("is part of computeBuild", () => expect(computeBuild("Ahri", null, many(12, () => game([3100, 3020, 3157, 3089])), items).buildOrder?.items).toHaveLength(4));
});

describe("itemStats (Data Dragon item text)", () => {
  it("reads the stat block into short keys and ignores lines it does not know", () => {
    const d = "<mainText><stats><attention>55</attention> Attack Damage<br><attention>20%</attention> Critical Strike Chance<br><attention>18</attention> Lethality<br><attention>10</attention> Ability Haste<br><attention>8%</attention> Armor Penetration</stats><br><br><passive>Rapture</passive></mainText>";
    expect(itemStats(d).sort()).toEqual(["ad", "arpen", "crit", "leth"]);
  });
  it("Heal and Shield Power, on-hit text and actives", () => {
    expect(itemStats("<stats><attention>40</attention> Ability Power<br><attention>15%</attention> Heal and Shield Power</stats>").sort()).toEqual(["ap", "hsp"]);
    expect(itemStats("<stats><attention>45</attention> Attack Damage</stats><passive>Deals bonus physical damage On-Hit</passive>")).toEqual(["ad", "onhit"]);
    expect(itemStats("<stats><attention>30</attention> Armor</stats><active>Active -</active> Shields allies")).toEqual(["armor", "active"]);
  });
  it("Armor is not Armor Penetration, and no text gives nothing", () => {
    expect(itemStats("<stats><attention>20</attention> Armor<br><attention>35%</attention> Armor Penetration</stats>").sort()).toEqual(["armor", "arpen"]);
    expect(itemStats(undefined)).toEqual([]); expect(itemStats("")).toEqual([]);
  });
});

describe("override table (ITEM_KIND_OVERRIDES)", () => {
  const meta = (name: string, stats: string[]): ItemMeta => it_(name, 3000, [], { stats });
  it("wins over the text rules, ignores case and punctuation, and falls back to the text for other items", () => {
    expect(itemKinds(meta("Heartsteel", ["hp", "ad"])).kinds).toEqual(["Tank"]);              // the text alone would say Bruiser
    expect(itemKinds(meta("HEARTSTEEL", ["hp"])).kinds).toEqual(["Tank"]);
    expect(itemKinds(meta("Guinsoo's Rageblade", ["ap", "as", "onhit"]))).toEqual({ kinds: ["On-Hit", "AD"], ad: true, ap: false });   // mainly AD on-hit; its AP is minor
    expect(itemKinds(meta("Collector", ["ad", "crit", "leth"])).kinds).toEqual(["Crit", "Lethality"]);
    expect(itemKinds(meta("Some New Item", ["ap"])).kinds).toEqual(["AP"]);
  });
  it("every entry names real kinds and has at least one", () => {
    for (const [name, v] of ITEM_KIND_OVERRIDES) { expect(v.kinds.length, name).toBeGreaterThan(0); for (const k of v.kinds) expect(PURE_ARCHETYPES as readonly string[], name).toContain(k); }
  });
  it("Guinsoo's with Kraken Slayer and a crit item is a Crit / On-Hit build, not Hybrid", () => {
    const m = new Map<number, ItemMeta>([[1, meta("Guinsoo's Rageblade", ["ap", "as", "onhit"])], [2, meta("Kraken Slayer", ["ad", "as", "onhit"])], [3, meta("Infinity Edge", ["ad", "crit"])], [4, meta("Phantom Dancer", ["crit", "as"])]]);
    expect(["Crit / On-Hit", "On-Hit / Crit"]).toContain(archetype([1, 2, 3, 4], m));
  });
});

describe("builds are grouped by core, labelled once, and never shown twice", () => {
  const AP = [3157, 3089, 3100], TANK = [3068, 3075, 3083];
  const many2 = (n: number, inv: number[], win = 1) => many(n, () => row(inv, win));
  it("keptItems: finished items only, once each, without boots, components or the support quest item", () => {
    expect(keptItems(row([3157, 3157, 3089, 3020, 1055, 9999]), items)).toEqual([3157, 3089]);
  });
  it("the same items in another order are one build", () => {
    const v = buildVariants("X", null, [...many2(15, AP), ...many2(15, [3100, 3157, 3089]), ...many2(12, TANK)], items);
    expect(v.map((x) => [x.id, x.games])).toEqual([["ap", 30], ["tank", 12]]);
  });
  it("one odd extra item does not make a second build: the label comes from the group's usual items", () => {
    // 30 games with the AP core and a common 4th item, 2 with a different 4th item: one AP variant of 32 games, next to the tank build
    const v = buildVariants("X", null, [...many2(30, [...AP, 3071]), ...many2(2, [...AP, 3068]), ...many2(12, TANK)], items);
    expect(v.map((x) => [x.id, x.games])).toEqual([["ap", 32], ["tank", 12]]);
  });
  it("two builds with the same three items under two names are joined (the screenshot case: On-Hit and On-Hit / AD)", () => {
    const m = new Map<number, ItemMeta>([[11, it_("Kraken Slayer", 3000, [], { stats: ["ad", "as", "onhit"] })], [12, it_("Guinsoo's Rageblade", 3000, [], { stats: ["ap", "as", "onhit"] })], [13, it_("Terminus", 3000, [], { stats: ["ad", "as", "onhit"] })],
      [14, it_("Statikk Shiv", 3000, [], { stats: ["ad", "as", "crit"] })], [15, it_("Plain A", 3000, ["Damage"])], [16, it_("Plain B", 3000, ["Damage"])], [17, it_("Wit's End", 3000, [], { stats: ["as", "mr", "onhit"] })],
      [3068, items.get(3068)!], [3075, items.get(3075)!], [3083, items.get(3083)!]]);
    // Same core 11, 12, 13. One half ends with two AD items (On-Hit / AD), the other with two tank items (On-Hit): same core, so ONE variant, not two.
    const rows = [...many(20, () => row([11, 12, 13, 15, 16])), ...many(20, () => row([13, 11, 12, 17, 3068])), ...many(12, () => row(TANK))];
    const v = buildVariants("Kaisa", null, rows, m);
    expect(v.filter((x) => x.label.startsWith("On-Hit"))).toHaveLength(1);
    expect(v.find((x) => x.label.startsWith("On-Hit"))!.games).toBe(40);
  });
  it("related labels sharing two of three core items are joined; unrelated kinds stay separate", () => {
    const m = new Map<number, ItemMeta>([[21, it_("A", 3000, [], { stats: ["ad", "as", "onhit"] })], [22, it_("B", 3000, [], { stats: ["ad", "as", "onhit"] })], [23, it_("C", 3000, [], { stats: ["ad", "as", "onhit"] })], [24, it_("D", 3000, [], { stats: ["ad", "as", "onhit"] })],
      [3157, items.get(3157)!], [3089, items.get(3089)!], [3100, items.get(3100)!]]);
    const rows = [...many(30, () => row([21, 22, 23])), ...many(20, () => row([21, 22, 24])), ...many(15, () => row(AP))];
    const v = buildVariants("X", null, rows, m);
    expect(v).toHaveLength(2); expect(v[0]!.games).toBe(50); expect(v[1]!.id).toBe("ap");
  });
  it("Nashor's Tooth builds with AP items are AP builds, not On-Hit", () => {
    const m = new Map<number, ItemMeta>([[31, it_("Nashor's Tooth", 3000, [], { stats: ["ap", "as", "onhit"] })], [32, it_("Void Staff", 3000, [], { stats: ["ap", "mpen"] })], [33, it_("Rabadon's", 3000, [], { stats: ["ap"] })], [34, it_("Rylai's", 3000, [], { stats: ["ap", "hp"] })]]);
    expect(archetype([31, 32, 33, 34], m)).toBe("AP");
  });
});

describe("on-hit items and Hybrid (Kai'Sa screenshot case)", () => {
  const k = (name: string, stats: string[]) => it_(name, 3000, [], { stats });
  const m = new Map<number, ItemMeta>([
    [8001, k("Kraken Slayer", ["ad", "as", "onhit"])], [8002, k("Terminus", ["ad", "as", "onhit"])], [8003, k("Nashor's Tooth", ["ap", "as", "onhit"])],
    [8004, k("Rabadon's", ["ap"])], [8005, k("Shadowflame", ["ap"])], [8006, k("Cosmic Drive", ["ap", "hp"])],
    [8007, k("Infinity Edge", ["ad", "crit"])], [8008, k("Bloodthirster", ["ad"])], [8009, k("Black Cleaver Like", ["ad", "hp"])],
  ]);
  it("Kraken Slayer + Nashor's Tooth is an On-Hit build, not Hybrid", () => {
    expect(archetype([8001, 8002, 8003], m)).not.toBe("Hybrid");
    expect(archetype([8001, 8002, 8003, 8004], m)).not.toBe("Hybrid");
  });
  it("two on-hit AD items and an AP item are On-Hit / AD or On-Hit", () => {
    expect(["On-Hit / AD", "On-Hit"]).toContain(archetype([8001, 8002, 8003], m));
  });
  it("real mixed scaling (non on-hit AD + AP items) is still Hybrid", () => {
    expect(archetype([8004, 8005, 8008, 8009], m)).toBe("Hybrid");
  });
  it("an AP build with one on-hit AP item stays AP", () => {
    expect(archetype([8003, 8004, 8005, 8006], m)).toBe("AP");
  });
});

describe("Kai'Sa-like champion keeps its separate builds", () => {
  const mk = (id: number, name: string, stats: string[]) => [id, it_(name, 3000, [], { stats })] as const;
  const m = new Map<number, ItemMeta>([
    mk(21, "Kraken Slayer", ["ad", "as", "onhit"]), mk(22, "Terminus", ["ad", "as", "onhit"]), mk(23, "Nashor's Tooth", ["ap", "as", "onhit"]),
    mk(24, "Guinsoo's Rageblade", ["ap", "as", "onhit"]), mk(25, "Rabadon's Deathcap", ["ap"]), mk(26, "Shadowflame", ["ap"]), mk(27, "Void Staff", ["ap"]),
    mk(28, "Bloodthirster", ["ad"]), mk(29, "Infinity Edge Like", ["ad", "crit"]), mk(30, "Cleaver Like", ["ad", "hp"]),
  ]);
  it("an AP build, an On-Hit build and a Hybrid build stay separate variants", () => {
    const rows = [
      ...many(40, () => row([25, 26, 27, 23, 25])),            // AP: Rabadon, Shadowflame, Void Staff, Nashor's
      ...many(30, () => row([21, 22, 23, 24, 28])),            // On-Hit: Kraken, Terminus, Nashor's, Guinsoo's
      ...many(20, () => row([25, 26, 28, 30, 23])),            // Hybrid: AP and AD items without on-hit scaling
    ];
    const v = buildVariants("Kaisa", null, rows, m);
    expect(v.length).toBeGreaterThanOrEqual(2);
    expect(new Set(v.map((x) => x.label)).size).toBe(v.length);
  });
});

describe("Kai'Sa log case: real item names keep On-Hit / AD and On-Hit / AP apart", () => {
  const mk = (id: number, name: string, stats: string[]) => [id, it_(name, 3000, [], { stats })] as const;
  const m = new Map<number, ItemMeta>([
    mk(41, "Guinsoo's Rageblade", ["ad", "ap", "as", "onhit"]), mk(42, "Terminus", ["ad", "as", "onhit"]), mk(43, "Kraken Slayer", ["ad", "as", "onhit"]),
    mk(44, "Nashor's Tooth", ["ap", "as", "onhit"]), mk(45, "Zhonya's Hourglass", ["ap", "armor"]), mk(46, "Rabadon's Deathcap", ["ap"]),
    mk(47, "Shadowflame", ["ap"]), mk(48, "Phantom Dancer", ["crit", "as"]),
  ]);
  it("Guinsoo + Terminus + Kraken games are On-Hit / AD, Nashor's + AP items are On-Hit / AP, and they are not joined", () => {
    const rows = [...many(60, () => row([41, 42, 43, 48])), ...many(30, () => row([44, 41, 43, 45, 46, 47]))];
    const v = buildVariants("Kaisa", null, rows, m);
    expect(v.map((x) => x.label).sort()).toEqual(["On-Hit / AD", "On-Hit / AP"]);
  });
});

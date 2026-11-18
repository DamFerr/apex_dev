import { describe, expect, it } from "vitest";
import { archetype, buildOrder, computeBuild, corePath, isFinished, isSupportUpgrade, itemBlocks, itemWpas, type BuildRow, type ItemMeta } from "./build";

// The three quest-line items and the five free upgrades, as Data Dragon holds them: cheap or free, no tags that say "support item".
const meta = (name: string, total: number, extra: Partial<ItemMeta> = {}): ItemMeta => ({ name, total, hasUpgrade: false, tags: [], ...extra });
const items = new Map<number, ItemMeta>([
  [3865, meta("World Atlas", 400, { hasUpgrade: true })], [3866, meta("Runic Compass", 400, { hasUpgrade: true })], [3867, meta("Bounty of Worlds", 400, { hasUpgrade: true })],
  [3869, meta("Celestial Opposition", 0, { tags: ["Health", "ManaRegen"] })], [3870, meta("Dream Maker", 0)], [3871, meta("Zaz\u2019Zak's Realmspike", 0, { tags: ["SpellDamage"] })],
  [3876, meta("Solstice Sleigh", 0)], [3877, meta("Bloodsong", 0)],
  [3190, meta("Locket of the Iron Solari", 2200, { tags: ["Armor", "SpellBlock", "Health"] })], [6617, meta("Moonstone Renewer", 2200, { tags: ["Health", "SpellDamage"] })],
  [3107, meta("Redemption", 2300, { tags: ["Health"] })], [3020, meta("Sorcerer's Shoes", 1100, { boots: true, hasUpgrade: true })],
]);
const row = (inv: number[], win = 1, over: Partial<BuildRow> = {}): BuildRow => ({ perks: null, items: JSON.stringify(inv), spell1: 4, spell2: 14, win, ...over });
const many = (n: number, make: (i: number) => BuildRow) => Array.from({ length: n }, (_, i) => make(i));

describe("support upgrades are finished items", () => {
  it("counts the five upgrades even though they cost little or nothing", () => {
    for (const id of [3869, 3870, 3871, 3876, 3877]) { expect(isSupportUpgrade(items.get(id))).toBe(true); expect(isFinished(items.get(id))).toBe(true); }
  });
  it("matches by name whatever the case or apostrophe, so a curly apostrophe still counts", () => {
    expect(isSupportUpgrade(meta("ZAZ'ZAK\u2019S  REALMSPIKE", 0))).toBe(true);
    expect(isSupportUpgrade(meta("Zazzaks Realmspike", 0))).toBe(true);
  });
  it("never counts the quest line itself (it transforms) or unknown cheap items", () => {
    for (const id of [3865, 3866, 3867]) { expect(isSupportUpgrade(items.get(id))).toBe(false); expect(isFinished(items.get(id))).toBe(false); }
    expect(isFinished(meta("Some Component", 800))).toBe(false);
    expect(isFinished(undefined)).toBe(false);
  });
  it("keeps the old rule for everything else (2000+ gold, no upgrade, not boots)", () => {
    expect(isFinished(items.get(3190))).toBe(true);
    expect(isFinished(items.get(3020))).toBe(false);
    expect(isFinished(meta("Pricey Component", 2500, { hasUpgrade: true }))).toBe(false);
  });
});

describe("a support's build shows the support upgrade", () => {
  const rows = [...many(8, (i) => row([3869, 3190, 3020], i % 2)), ...many(4, (i) => row([3876, 6617, 3020], i % 2)), row([3865, 3190])];
  it("lists the support upgrades in the item blocks with their own games and wins, most built first", () => {
    const blocks = itemBlocks(rows, items), all = blocks.flatMap((b) => b.items);
    const celestial = all.find((i) => i.id === 3869)!, sleigh = all.find((i) => i.id === 3876)!;
    expect(celestial).toMatchObject({ name: "Celestial Opposition", games: 8, wins: 4 });
    expect(sleigh).toMatchObject({ name: "Solstice Sleigh", games: 4, wins: 2 });
    expect(all.some((i) => [3865, 3866, 3867].includes(i.id))).toBe(false);     // the unfinished quest item of the odd game is not a build item
    const sup = blocks.find((b) => b.name === "Support item")!;                  // its own block, like the boots
    expect(sup.items.map((i) => i.id)).toEqual([3869, 3876]);                    // most built first
    expect(blocks.filter((b) => b.name !== "Support item").flatMap((b) => b.items).some((i) => [3869, 3876].includes(i.id))).toBe(false);   // never in Core or Situational
  });
  it("puts the support upgrade into the usual build order at its real purchase position (when the timeline records it)", () => {
    const withBuys = many(12, (i) => row([3869, 3190, 6617, 3107, 3020], i % 2, { buys: JSON.stringify([3865, 3869, 3190, 6617, 3107, 3020]) }));
    expect(corePath(withBuys, items)!.items.map((i) => i.id)).toEqual([3190, 6617, 3107]);    // the three real items: the support item is not one of the core three
    expect(buildOrder(withBuys, items)!.items.map((i) => i.id)).toEqual([3869, 3190, 6617, 3107, 3020]);
  });
  it("ALWAYS puts the support item into the build order, even when the timeline never records its purchase (the quest upgrade is not a purchase)", () => {
    const noPurchase = many(12, (i) => row([3869, 3190, 6617, 3107, 3020], i % 2, { buys: JSON.stringify([3865, 3190, 3020, 6617, 3107]) }));   // the final inventory has 3869, the buys do not
    const order = buildOrder(noPurchase, items)!.items.map((i) => i.id);
    expect(order).toEqual([3869, 3190, 3020, 6617, 3107]);                          // support item first (never seen in a timeline), boots where they are bought
    const blocks = computeBuild("Rakan", "SUPPORT", noPurchase, items, false).itemBlocks;
    expect(blocks.find((b) => b.name === "Situational")?.items.map((i) => i.id) ?? []).not.toContain(3869);
  });
  it("uses the place where the timeline does show the support item, averaged over the games", () => {
    const late = many(12, (i) => row([3190, 6617, 3107, 3869], i % 2, { buys: JSON.stringify([3190, 6617, 3869, 3107]) }));
    expect(buildOrder(late, items)!.items.map((i) => i.id)).toEqual([3190, 6617, 3869, 3107]);
  });
  it("the slot shows the most common support item; the others stay in the Support item block, once", () => {
    const rows3 = many(12, (i) => row([i < 9 ? 3869 : 3876, 3190, 6617, 3107], 1, { buys: JSON.stringify([3190, 6617, 3107]) }));
    expect(buildOrder(rows3, items)!.items[0].id).toBe(3869);
    const sup = computeBuild("Thresh", "SUPPORT", rows3, items, false).itemBlocks.find((b) => b.name === "Support item")!;
    expect(sup.items.map((i) => i.id)).toEqual([3869, 3876]);
  });
  it("is left out of the order when under 40% of the games had one, but is still listed in its own block", () => {
    const few = many(12, (i) => row(i < 4 ? [3869, 3190, 6617, 3107] : [3190, 6617, 3107], 1, { buys: JSON.stringify([3190, 6617, 3107]) }));   // 4 of 12 = 33%
    expect(buildOrder(few, items)!.items.map((i) => i.id)).toEqual([3190, 6617, 3107]);
    expect(computeBuild("X", null, few, items, false).itemBlocks.find((b) => b.name === "Support item")!.items.map((i) => i.id)).toEqual([3869]);
  });
  it("a champion without support items gets no Support item block and an unchanged order", () => {
    const adc = many(12, () => row([3190, 6617, 3107, 3020], 1, { buys: JSON.stringify([3190, 3020, 6617, 3107]) }));
    expect(computeBuild("Jinx", "ADC", adc, items, false).itemBlocks.some((b) => b.name === "Support item")).toBe(false);
    expect(buildOrder(adc, items)!.items.map((i) => i.id)).toEqual([3190, 3020, 6617, 3107]);
  });
  it("does not let the support upgrade decide whether a build is AP, AD or Tank", () => {
    // Celestial Opposition carries Health, which would count as a Tank item: with two real AP items the game must stay AP
    expect(archetype([3869, 6617, 3107, 3190], items)).not.toBeNull();
    expect(archetype([3869, 6617, 6617], items)).toBeNull();                   // only one real item besides the support item: too few to classify
  });
  it("gives the support upgrade a Win Probability Added like any other item", () => {
    const rows2 = many(60, (i) => row(i < 30 ? [3869, 3190, 3020] : [3876, 3190, 3020], i % 3 === 0 ? 0 : 1, { duration: 1800 } as Partial<BuildRow>));
    const w = itemWpas(rows2.map((r) => ({ ...r, duration: 1800 })), items);
    expect(w.has(3869) || w.has(3876)).toBe(true);
  });
  it("flows through computeBuild, which is what the champion page and the draft item set import use", () => {
    const b = computeBuild("Thresh", "SUPPORT", rows, items, false);
    expect(b.itemBlocks.flatMap((x) => x.items).map((i) => i.id)).toContain(3869);
    expect(b.itemBlocks[0].name).toBe("Support item");
  });
});

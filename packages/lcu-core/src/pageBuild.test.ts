import { describe, expect, it } from "vitest";
import type { BuildVariant, ChampionBuild } from "@apex/schema";
import { itemLayout, pageBuild, sortVariants, spellPairsOf } from "./pageBuild";

const core = (games: number, wins: number, extra: object = {}) => ({ champion: "Ahri", role: null, games, wins, runePages: [], keystones: [], spells: null, itemBlocks: [], timelineGames: 0, skillOrder: null, startItems: null, corePath: null, ...extra });
const v = (id: string, games: number, wins: number): BuildVariant => ({ id: id as never, label: id, games, wins, build: core(games, wins) as never });
const champ = (variants?: BuildVariant[]) => ({ ...core(500, 250), ...(variants ? { variants } : {}) }) as unknown as ChampionBuild;

describe("sortVariants", () => {
  const b = champ([v("AD", 30, 18), v("AP", 600, 340), v("Tank", 90, 55)]);      // AD: 60% on 30 games, AP: 57% on 600, Tank: 61% on 90
  it("Best ranks by the lower end of the 95% range, so a small lucky sample cannot win", () => expect(sortVariants(b, "best").map((x) => x.id)).toEqual(["AP", "Tank", "AD"]));
  it("Win rate ranks by the shrunk win rate", () => expect(sortVariants(b, "rate")[0].id).toBe("Tank"));
  it("Common ranks by games", () => expect(sortVariants(b, "common").map((x) => x.id)).toEqual(["AP", "Tank", "AD"]));
  it("does not change the input and handles no variants", () => { sortVariants(b, "best"); expect(b.variants![0].id).toBe("AD"); expect(sortVariants(champ(), "best")).toEqual([]); });
});

describe("pageBuild (the build the champion page, the overlay and the import all use)", () => {
  it("is the whole champion when there are no variants", () => { const b = champ(); expect(pageBuild(b)).toEqual({ core: b, variant: null }); });
  it("is the best variant by default, so the import matches what the page opens with", () => {
    const b = champ([v("AD", 30, 18), v("AP", 600, 340)]); const p = pageBuild(b);
    expect(p.variant?.id).toBe("AP"); expect(p.core).toBe(p.variant!.build);
  });
  it("follows the chosen sort and variant, and falls back to the first one for an unknown id", () => {
    const b = champ([v("AD", 30, 18), v("AP", 600, 340), v("Tank", 90, 55)]);
    expect(pageBuild(b, "rate").variant?.id).toBe("Tank"); expect(pageBuild(b, "best", "AD").variant?.id).toBe("AD"); expect(pageBuild(b, "best", "nope").variant?.id).toBe("AP");
  });
});

describe("spellPairsOf", () => {
  const pair = (a: number, g = 20) => ({ ids: [a, 4] as [number, number], games: g, wins: 10 });
  it("uses the pairs the page shows, first one first", () => expect(spellPairsOf({ spells: pair(14), spellPairs: [pair(12), pair(14)] }).map((p) => p.ids[0])).toEqual([12, 14]));
  it("falls back to the single pair, or nothing", () => { expect(spellPairsOf({ spells: pair(14), spellPairs: [] })).toHaveLength(1); expect(spellPairsOf({ spells: null })).toEqual([]); });
});

describe("itemLayout", () => {
  const it_ = (id: number) => ({ id, name: `i${id}`, games: 5, wins: 2 });
  const path = (...ids: number[]) => ({ items: ids.map((id) => ({ id, name: `i${id}`, count: 1 })), games: 9, wins: 5 });
  it("shows every item once: boots in the order are not repeated, the Core block is replaced by the order", () => {
    const l = itemLayout({ itemBlocks: [{ name: "Boots", items: [it_(1), it_(2)] }, { name: "Core items", items: [it_(10), it_(11)] }, { name: "Situational", items: [it_(10), it_(12)] }], buildOrder: path(10, 1, 11) });
    expect(l.order?.items.map((i) => i.id)).toEqual([10, 1, 11]);
    expect(l.groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([["Boots options", [2]], ["Situational", [12]]]);
  });
  it("falls back to the core path (no boots in it), and keeps the whole Boots block as options", () => {
    const l = itemLayout({ itemBlocks: [{ name: "Boots", items: [it_(1), it_(2)] }], corePath: path(10, 11) });
    expect(l.order?.items.map((i) => i.id)).toEqual([10, 11]); expect(l.groups[0]).toMatchObject({ label: "Boots options" }); expect(l.groups[0].items).toHaveLength(2);
  });
  it("without any order, Core items stay (by popularity) and nothing is removed", () => {
    const l = itemLayout({ itemBlocks: [{ name: "Core items", items: [it_(10)] }] });
    expect(l.order).toBeNull(); expect(l.groups.map((g) => g.label)).toEqual(["Core items"]);
  });
  it("keeps the support item in the order (never under Situational) and lists the other support items as options", () => {
    const l = itemLayout({ itemBlocks: [{ name: "Support item", items: [it_(3869), it_(3876)] }, { name: "Boots", items: [it_(1)] }, { name: "Core items", items: [it_(10)] }, { name: "Situational", items: [it_(12)] }], buildOrder: path(3869, 10, 1) });
    expect(l.order?.items.map((i) => i.id)).toEqual([3869, 10, 1]);
    expect(l.groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([["Support item options", [3876]], ["Situational", [12]]]);
  });
  it("calls the block just 'Support item' when the order has none (no timeline data yet), and drops it when the only support item is in the order", () => {
    const none = itemLayout({ itemBlocks: [{ name: "Support item", items: [it_(3869)] }, { name: "Core items", items: [it_(10)] }] });
    expect(none.groups.map((g) => g.label)).toEqual(["Support item", "Core items"]);
    const only = itemLayout({ itemBlocks: [{ name: "Support item", items: [it_(3869)] }], buildOrder: path(3869, 10) });
    expect(only.groups).toEqual([]);
  });
  it("returns the starting items untouched", () => expect(itemLayout({ itemBlocks: [], startItems: path(1055) }).start?.items[0].id).toBe(1055));
});

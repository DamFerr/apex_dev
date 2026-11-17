import { describe, expect, it } from "vitest";
import type { BuildVariant, ChampionBuild } from "@apex/schema";
import { buildItemSet, buildItemSets, ITEM_SET_PREFIX, MAX_APEX_SETS, mergeItemSets } from "./items";

const it_ = (id: number, games = 5) => ({ id, name: `i${id}`, games, wins: Math.floor(games / 2) });
const path = (...ids: number[]) => ({ items: ids.map((id) => ({ id, name: `i${id}`, count: 1 })), games: 9, wins: 5 });
const build = { itemBlocks: [{ name: "Boots", items: [it_(3020)] }, { name: "Core items", items: [it_(3157), it_(3089)] }, { name: "Situational", items: [] }] };

describe("buildItemSet", () => {
  it("makes a set tied to the champion and Summoner's Rift, with one block per non-empty group", () => {
    const s = buildItemSet(build, 103, "Ahri")!;
    expect(s).toMatchObject({ uid: "apex-103", title: `${ITEM_SET_PREFIX}Ahri`, associatedChampions: [103], associatedMaps: [11], type: "custom" });
    expect(s.blocks.map((b) => b.type)).toEqual(["Boots options", "Core items"]);        // no build order: core items by popularity, boots are options
    expect(s.blocks[1].items).toEqual([{ id: "3157", count: 1 }, { id: "3089", count: 1 }]);
  });
  it("returns null when there is nothing to put in a set", () => expect(buildItemSet({ itemBlocks: [] }, 1, "X")).toBeNull());
});

describe("buildItemSet is laid out like the champion page", () => {
  const timeline = { startItems: { items: [{ id: 1055, name: "d", count: 1 }, { id: 2003, name: "p", count: 2 }], games: 9, wins: 5 } };
  it("starting items (with counts), then the build order, then the boots options; no separate Core block", () => {
    const s = buildItemSet({ ...build, ...timeline, corePath: path(3157, 3089, 3100) }, 103, "Ahri")!;
    expect(s.blocks.map((b) => b.type)).toEqual(["Starting items", "Build order", "Boots options"]);
    expect(s.blocks[0].items).toEqual([{ id: "1055", count: 1 }, { id: "2003", count: 2 }]);
    expect(s.blocks[1].items.map((i) => i.id)).toEqual(["3157", "3089", "3100"]);
  });
  it("puts the usual boots inside the build order, where they are bought, and lists only the OTHER boots as options", () => {
    const withBoots = { itemBlocks: [{ name: "Boots", items: [it_(3020, 9), it_(3047, 4), it_(3009, 2)] }, { name: "Core items", ordered: true, items: [it_(3157), it_(3089), it_(3100)] }, { name: "Situational", items: [it_(3065), it_(3157)] }],
      corePath: path(3157, 3089, 3100), buildOrder: path(3157, 3020, 3089, 3100) };
    const s = buildItemSet(withBoots, 103, "Ahri")!;
    expect(s.blocks.map((b) => b.type)).toEqual(["Build order", "Boots options", "Situational"]);
    expect(s.blocks[0].items.map((i) => i.id)).toEqual(["3157", "3020", "3089", "3100"]);            // boots second
    expect(s.blocks[1].items.map((i) => i.id)).toEqual(["3047", "3009"]);                             // not 3020 again
    expect(s.blocks[2].items.map((i) => i.id)).toEqual(["3065"]);                                     // 3157 is in the order, so it is not repeated
    const ids = s.blocks.flatMap((b) => b.items.map((i) => i.id)); expect(new Set(ids).size).toBe(ids.length);   // every item once
  });
  it("drops the Boots options block when the usual boots are the only boots", () => {
    const s = buildItemSet({ itemBlocks: [{ name: "Boots", items: [it_(3020, 9)] }, { name: "Core items", ordered: true, items: [it_(3157)] }], corePath: path(3157), buildOrder: path(3157, 3020) }, 1, "X")!;
    expect(s.blocks.map((b) => b.type)).toEqual(["Build order"]);
  });
  it("can build a set from timeline data alone", () => expect(buildItemSet({ itemBlocks: [], corePath: path(3157) }, 1, "X")?.blocks).toHaveLength(1));
});

describe("buildItemSets (one set per build variant, like the page)", () => {
  const variant = (id: string, label: string, games: number, wins: number, ids: number[]): BuildVariant => ({ id: id as never, label, games, wins, build: { ...base, games, wins, itemBlocks: [{ name: "Core items", items: ids.map((i) => it_(i)) }] } as never });
  const base = { champion: "Ahri", role: null, games: 100, wins: 50, runePages: [], keystones: [], spells: null, itemBlocks: [], timelineGames: 0, skillOrder: null, startItems: null, corePath: null };
  const full = (variants?: BuildVariant[]) => ({ ...base, ...(variants ? { variants } : {}), itemBlocks: [{ name: "Core items", items: [it_(1)] }] }) as unknown as ChampionBuild;
  it("is one plain set without variants", () => { const s = buildItemSets(full(), 103, "Ahri"); expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ uid: "apex-103", title: "Apex: Ahri" }); });
  it("is one set per variant, best first, each with its own uid, title and items", () => {
    const s = buildItemSets(full([variant("AD", "AD", 40, 18, [3031]), variant("AP", "AP", 400, 240, [3157])]), 103, "Ahri");
    expect(s.map((x) => x.title)).toEqual(["Apex: Ahri (AP)", "Apex: Ahri (AD)"]);
    expect(s.map((x) => x.uid)).toEqual(["apex-103-AP", "apex-103-AD"]); expect(s.map((x) => x.sortrank)).toEqual([1, 2]);
    expect(s[0].blocks[0].items).toEqual([{ id: "3157", count: 1 }]);
  });
});

describe("mergeItemSets", () => {
  const mine = buildItemSet(build, 103, "Ahri")!;
  const own = { uid: "u1", title: "My Ahri set" }, tricky = { uid: "u2", title: "apex: lowercase is not ours" };
  it("never touches sets that are not Apex's, even ones with similar titles", () => {
    const out = mergeItemSets([own, tricky], mine);
    expect(out).toContain(own); expect(out).toContain(tricky); expect(out).toContain(mine); expect(out).toHaveLength(3);
  });
  it("replaces this champion's earlier Apex set instead of adding a second one", () => {
    const old = { uid: "apex-103", title: "Apex: Ahri", blocks: ["old"] };
    const out = mergeItemSets([own, old], mine);
    expect(out).not.toContain(old); expect(out.filter((s) => (s as { uid: string }).uid === "apex-103")).toHaveLength(1);
  });
  it("replaces ALL of this champion's earlier Apex sets (plain and every variant), and only this champion's", () => {
    const olds = [{ uid: "apex-103", title: "Apex: Ahri" }, { uid: "apex-103-AD", title: "Apex: Ahri (AD)" }, { uid: "apex-103-Tank", title: "Apex: Ahri (Tank)" }], other = { uid: "apex-1030", title: "Apex: Other" }, jinx = { uid: "apex-222", title: "Apex: Jinx" };
    const out = mergeItemSets([own, ...olds, other, jinx], [mine]);
    for (const o of olds) expect(out).not.toContain(o);
    expect(out).toContain(other); expect(out).toContain(jinx); expect(out).toContain(own);          // apex-1030 is not champion 103
  });
  it("writes several sets for one champion and keeps the others", () => {
    const a = { ...mine, uid: "apex-103-AP" }, b = { ...mine, uid: "apex-103-AD" };
    expect(mergeItemSets([own], [a, b])).toEqual([own, a, b]);
  });
  it("keeps other champions' Apex sets but trims them to the limit", () => {
    const apex = Array.from({ length: 60 }, (_, i) => ({ uid: `apex-${1000 + i}`, title: `${ITEM_SET_PREFIX}C${i}` }));
    const out = mergeItemSets([own, ...apex], mine);
    expect(out.filter((s) => (s as { title: string }).title.startsWith(ITEM_SET_PREFIX))).toHaveLength(MAX_APEX_SETS);
    expect(out).toContain(own);
  });
  it("works on an empty list", () => expect(mergeItemSets([], mine)).toEqual([mine]));
});

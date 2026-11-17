import { describe, expect, it } from "vitest";
import { buildItemSet, ITEM_SET_PREFIX, MAX_APEX_SETS, mergeItemSets } from "./items";

const build = { itemBlocks: [{ name: "Boots", items: [{ id: 3020, name: "x", games: 5, wins: 3 }] }, { name: "Core items", items: [{ id: 3157, name: "y", games: 4, wins: 2 }, { id: 3089, name: "z", games: 3, wins: 1 }] }, { name: "Situational", items: [] }] };

describe("buildItemSet", () => {
  it("makes a set tied to the champion and Summoner's Rift, with one block per non-empty group", () => {
    const s = buildItemSet(build, 103, "Ahri")!;
    expect(s).toMatchObject({ uid: "apex-103", title: `${ITEM_SET_PREFIX}Ahri`, associatedChampions: [103], associatedMaps: [11], type: "custom" });
    expect(s.blocks.map((b) => b.type)).toEqual(["Boots", "Core items"]);
    expect(s.blocks[1].items).toEqual([{ id: "3157", count: 1 }, { id: "3089", count: 1 }]);
  });
  it("returns null when there is nothing to put in a set", () => expect(buildItemSet({ itemBlocks: [] }, 1, "X")).toBeNull());
});

describe("buildItemSet with timeline data", () => {
  it("puts starting items (with counts) and the build order before the other blocks", () => {
    const s = buildItemSet({ ...build, startItems: { items: [{ id: 1055, name: "d", count: 1 }, { id: 2003, name: "p", count: 2 }], games: 9, wins: 5 }, corePath: { items: [{ id: 3157, name: "z", count: 1 }, { id: 3089, name: "r", count: 1 }, { id: 3100, name: "l", count: 1 }], games: 7, wins: 4 } }, 103, "Ahri")!;
    expect(s.blocks.map((b) => b.type)).toEqual(["Starting items", "Build order", "Boots", "Core items"]);
    expect(s.blocks[0].items).toEqual([{ id: "1055", count: 1 }, { id: "2003", count: 2 }]);
    expect(s.blocks[1].items.map((i) => i.id)).toEqual(["3157", "3089", "3100"]);
  });
  it("can build a set from timeline data alone", () => expect(buildItemSet({ itemBlocks: [], corePath: { items: [{ id: 3157, name: "z", count: 1 }], games: 5, wins: 2 } }, 1, "X")?.blocks).toHaveLength(1));
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
  it("keeps other champions' Apex sets but trims them to the limit", () => {
    const apex = Array.from({ length: 30 }, (_, i) => ({ uid: `apex-${1000 + i}`, title: `${ITEM_SET_PREFIX}C${i}` }));
    const out = mergeItemSets([own, ...apex], mine);
    expect(out.filter((s) => (s as { title: string }).title.startsWith(ITEM_SET_PREFIX))).toHaveLength(MAX_APEX_SETS);
    expect(out).toContain(own);
  });
  it("works on an empty list", () => expect(mergeItemSets([], mine)).toEqual([mine]));
});

describe("buildItemSet with an ordered Core block", () => {
  it("does not add a second \"Build order\" block for the same items", () => {
    const ordered = { itemBlocks: [{ name: "Core items", ordered: true, items: [{ id: 3100, name: "l", games: 9, wins: 5 }, { id: 3157, name: "z", games: 9, wins: 5 }, { id: 3089, name: "r", games: 9, wins: 5 }] }],
      corePath: { items: [{ id: 3100, name: "l", count: 1 }, { id: 3157, name: "z", count: 1 }, { id: 3089, name: "r", count: 1 }], games: 9, wins: 5 } };
    const s = buildItemSet(ordered, 103, "Ahri")!;
    expect(s.blocks.map((b) => b.type)).toEqual(["Core items (build order)"]);
    expect(s.blocks[0].items.map((i) => i.id)).toEqual(["3100", "3157", "3089"]);
  });
});

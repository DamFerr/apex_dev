import { describe, expect, it } from "vitest";
import { corePath, skillOrder, skillPriority, startItems, type ItemMeta } from "./build";
import { extractTimeline, inShare, START_MS } from "./timeline";
import { timelineFixture } from "./testkit";
import type { RiotTimeline } from "./riot";

const items = new Map<number, ItemMeta>([[1055, { name: "Doran's Blade", total: 450, hasUpgrade: true }], [2003, { name: "Health Potion", total: 50, hasUpgrade: false }], [3340, { name: "Ward", total: 0, hasUpgrade: false }],
  [3020, { name: "Shoes", total: 1100, hasUpgrade: false, boots: true }], [3157, { name: "Zhonya", total: 3250, hasUpgrade: false }], [3089, { name: "Rabadon", total: 3600, hasUpgrade: false }], [3100, { name: "Lich Bane", total: 3000, hasUpgrade: false }]]);

describe("extractTimeline", () => {
  it("reads skill order, starting items and later purchases per player, undoing misclicks", () => {
    const p = extractTimeline(timelineFixture()).get("p3")!;
    expect(p.skills).toHaveLength(18);
    expect(p.skills.slice(0, 6)).toEqual([1, 2, 3, 1, 1, 4]);
    expect(p.start).toEqual([1055, 2003, 2003, 3340]);
    expect(p.buys).toEqual([3020, 3157, 3089, 3100]);        // the undone Lich Bane at 11:40 is gone, the real one at 25:00 stays
  });
  it("maps participant ids to puuids by position and ignores other event types", () => {
    const tl: RiotTimeline = { metadata: { participants: ["a", "b"] }, info: { frames: [{ events: [{ type: "ITEM_PURCHASED", timestamp: 5, participantId: 2, itemId: 1055 }, { type: "WARD_PLACED", timestamp: 6, participantId: 1 },
      { type: "SKILL_LEVEL_UP", timestamp: 7, participantId: 1, skillSlot: 1, levelUpType: "EVOLVE" }] }, { }] } };
    const m = extractTimeline(tl);
    expect(m.get("b")!.start).toEqual([1055]); expect(m.get("a")).toEqual({ skills: [], start: [], buys: [] });   // a frame without events is fine; evolve points are not skill order
  });
  it("splits starting items from later buys at the START_MS boundary and sorts events by time", () => {
    const tl: RiotTimeline = { metadata: { participants: ["a"] }, info: { frames: [{ events: [{ type: "ITEM_PURCHASED", timestamp: START_MS + 1, participantId: 1, itemId: 3020 }, { type: "ITEM_PURCHASED", timestamp: START_MS, participantId: 1, itemId: 1055 }] }] } };
    expect(extractTimeline(tl).get("a")).toEqual({ skills: [], start: [1055], buys: [3020] });
  });
});

describe("inShare", () => {
  it("is deterministic and roughly matches the share", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `EUW1_${7000000000 + i * 13}`), hit = ids.filter((i) => inShare(i, 0.25)).length;
    expect(hit).toBeGreaterThan(400); expect(hit).toBeLessThan(600);
    expect(ids.every((i) => inShare(i, 1))).toBe(true); expect(ids.some((i) => inShare(i, 0))).toBe(false);
    expect(inShare("EUW1_1", 0.5)).toBe(inShare("EUW1_1", 0.5));
  });
});

describe("skill order", () => {
  it("ranks Q, W, E by when each reaches rank 5, not by points spent", () => expect(skillPriority([1, 2, 3, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2])).toEqual(["Q", "E", "W"]));
  it("needs at least 9 skill points", () => expect(skillPriority([1, 2, 3, 1, 1, 4, 1, 3])).toBeNull());
  it("puts a skill that was never maxed last", () => expect(skillPriority([1, 2, 1, 2, 1, 4, 1, 2, 1, 3, 3, 4])).toEqual(["Q", "W", "E"]));
  const row = (skills: number[], win = 1) => ({ perks: null, items: "[]", spell1: null, spell2: null, win, skills: JSON.stringify(skills) });
  const qew = [1, 2, 3, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2, 4, 2, 2], qwe = [1, 2, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3];
  it("takes the most played priority and a real first-9 sequence from games with it", () => {
    const s = skillOrder([row(qew), row(qew, 0), row(qwe)])!;
    expect(s).toMatchObject({ max: ["Q", "E", "W"], games: 2, wins: 1 }); expect(s.levels.join("")).toBe("QWEQQRQEQ");
  });
  it("is null without usable data", () => expect(skillOrder([{ ...row(qew), skills: null }, { ...row(qew), skills: "oops" }, row([9, 9, 9, 9, 9, 9, 9, 9, 9])])).toBeNull());
});

describe("starting items and core path", () => {
  const row = (start: number[], buys: number[], win = 1) => ({ perks: null, items: "[]", spell1: null, spell2: null, win, start: JSON.stringify(start), buys: JSON.stringify(buys) });
  it("starting items: most common set with counts, trinkets left out", () => {
    const s = startItems([row([2003, 1055, 2003, 3340], []), row([1055, 2003, 2003], [], 0), row([2003], [])], items)!;
    expect(s.games).toBe(2); expect(s.wins).toBe(1);
    expect(s.items).toEqual([{ id: 1055, name: "Doran's Blade", count: 1 }, { id: 2003, name: "Health Potion", count: 2 }]);
  });
  // A row: final inventory (what the player kept) and purchases after the start, in order.
  const game = (buys: number[], final: number[], win = 1) => ({ ...row([], buys, win), items: JSON.stringify(final) });
  const many = (n: number, make: (i: number) => ReturnType<typeof game>) => Array.from({ length: n }, (_, i) => make(i));
  const meta = new Map<number, ItemMeta>([...items, [6653, { name: "Liandry's Torment", total: 3000, hasUpgrade: false }], [3020, { name: "Sorcerer's Shoes", total: 1100, hasUpgrade: false, boots: true }]]);

  it("core path: the three core items in build order, no boots, components or repeats", () => {
    const c = corePath(many(12, () => game([3020, 1055, 3157, 3157, 3089, 3100], [3157, 3089, 3100, 3020])), meta)!;
    expect(c.items.map((i) => i.id)).toEqual([3157, 3089, 3100]); expect(c.games).toBe(12);
  });
  it("core path is null with too few games instead of picking an arbitrary triple (the Naafiri bug: every triple had 1 game, the lowest id won)", () => {
    const rows = [game([6653, 3100, 3089], [6653, 3100, 3089]), game([3157, 3089, 3100], [3157, 3089, 3100]), game([3089, 3157, 6653], [3089, 3157, 6653])];
    expect(corePath(rows, meta)).toBeNull();
    expect(corePath(rows, meta, 1)).not.toBeNull();   // the minimum is a parameter; below it nothing is shown
  });
  it("core path ignores items that were bought but not kept (sold, swapped)", () => {
    const c = corePath(many(12, () => game([6653, 3157, 3089, 3100], [3157, 3089, 3100])), meta)!;   // Liandry's bought first, sold before the end
    expect(c.items.map((i) => i.id)).toEqual([3157, 3089, 3100]);
  });
  it("core path orders by typical position, so players who swap two items do not split the sample", () => {
    const rows = [...many(8, () => game([3157, 3089, 3100], [3157, 3089, 3100])), ...many(4, () => game([3089, 3157, 3100], [3157, 3089, 3100], 0))];
    const c = corePath(rows, meta)!;
    expect(c.items.map((i) => i.id)).toEqual([3157, 3089, 3100]); expect(c.games).toBe(12); expect(c.wins).toBe(8);
  });
  it("core path counts only games that kept all three core items", () => {
    const rows = [...many(10, () => game([3157, 3089, 3100], [3157, 3089, 3100])), game([3157, 3089], [3157, 3089]), game([3157], [3157])];
    expect(corePath(rows, meta)!.games).toBe(10);
  });
  it("core path ignores games without usable data and fewer than three finished items", () => {
    expect(corePath([game([3157, 3089], [3157, 3089]), row([], [3157, 3089, 3100])], meta, 1)).toBeNull();   // second row has no final inventory
    expect(corePath([{ ...row([], []), buys: "oops" }], meta, 1)).toBeNull();
  });
});

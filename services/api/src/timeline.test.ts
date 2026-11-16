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
  it("core path: first three finished items in buying order, no boots, components or repeats", () => {
    const c = corePath([row([], [3020, 1055, 3157, 3157, 3089, 3100]), row([], [3157, 3089, 3100, 3020]), row([], [3089, 3157, 3100])], items)!;
    expect(c.items.map((i) => i.id)).toEqual([3157, 3089, 3100]); expect(c.games).toBe(2);
  });
  it("core path ignores games that finished fewer than three items", () => expect(corePath([row([], [3157, 3089])], items)).toBeNull());
});

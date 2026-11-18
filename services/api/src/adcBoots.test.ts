import { describe, expect, it, vi } from "vitest";
import { buildOrder, computeBuild, repairBoots, type BuildRow, type ItemMeta } from "./build";
import { extraItemFields, extraItems, noteExtraFields, resetNoteForTests } from "./participantItems";
import { toLoadout } from "./mapping";
import type { RiotParticipant } from "./riot";

const m = (name: string, total: number, tags: string[], extra: Partial<ItemMeta> = {}): ItemMeta => ({ name, total, hasUpgrade: false, tags, ...extra });
const items = new Map<number, ItemMeta>([[3031, m("Infinity Edge", 3400, ["Damage", "CriticalStrike"])], [3036, m("Lord Dominik's", 3000, ["Damage"])], [3094, m("Rapid Firecannon", 2600, ["Damage"])],
  [3006, m("Berserker's Greaves", 1100, ["Boots"], { boots: true, hasUpgrade: true })], [3047, m("Plated Steelcaps", 1100, ["Boots"], { boots: true, hasUpgrade: true })]]);
const part = (over: Record<string, unknown>): RiotParticipant => ({ puuid: "x", championName: "Jinx", teamId: 100, teamPosition: "BOTTOM", win: true, kills: 0, deaths: 0, assists: 0, totalMinionsKilled: 0, neutralMinionsKilled: 0,
  totalDamageDealtToChampions: 0, goldEarned: 0, visionScore: 0, ...over }) as RiotParticipant;

describe("extra item fields (the role quest slot)", () => {
  it("reads item7+ and roleBound / roleQuest fields, never item0..item6, never zeros or non-numbers", () => {
    const p = part({ item0: 3031, item6: 3340, item7: 3006, roleBoundItem: 3047, roleQuestItem: 0, roleBoundNote: "x" });
    expect(extraItemFields(p)).toEqual([{ field: "item7", id: 3006 }, { field: "roleBoundItem", id: 3047 }]);
    expect(extraItems(part({ item0: 1, item1: 2 }))).toEqual([]);
  });
  it("is case-insensitive and reads any slot number above 6", () => expect(extraItems(part({ ITEM9: 5, Item8: 6 }))).toEqual([5, 6]));
  it("warns once, naming the field, so a wrong guess about the field name shows in the log", () => {
    resetNoteForTests(); const log = vi.fn();
    noteExtraFields(part({ roleBoundItem: 3006 }), log); noteExtraFields(part({ roleBoundItem: 3006 }), log); noteExtraFields(part({}), log);
    expect(log).toHaveBeenCalledTimes(1); expect(log.mock.calls[0][0]).toContain("roleBoundItem=3006");
  });
  it("does not warn when there are none", () => { resetNoteForTests(); const log = vi.fn(); noteExtraFields(part({ item0: 1 }), log); expect(log).not.toHaveBeenCalled(); });
  it("the match history shows the boots from the extra slot, and the trinket stays slot 6", () => {
    const l = toLoadout(part({ item0: 3031, item1: 3036, item6: 3340, item7: 3006 }));
    expect(l.items).toEqual([3031, 3036, 3006]); expect(l.trinket).toBe(3340);
  });
});

const row = (final: number[], buys: number[] | null, win = 1): BuildRow => ({ perks: null, items: JSON.stringify(final), spell1: 4, spell2: 7, win, ...(buys ? { buys: JSON.stringify(buys) } : {}) });
const many = (n: number, make: (i: number) => BuildRow) => Array.from({ length: n }, (_, i) => make(i));

describe("repairBoots (games stored before the role quest slot was read)", () => {
  it("adds the last boots bought when the final inventory has none", () => expect(JSON.parse(repairBoots(row([3031, 3036], [3006, 3031, 3047, 3036]), items).items)).toEqual([3031, 3036, 3047]));
  it("leaves a game that has boots, no timeline, or no boots purchase as it is", () => {
    const a = row([3031, 3006], [3006, 3031]), b = row([3031], null), c = row([3031], [3031]);
    expect(repairBoots(a, items)).toBe(a); expect(repairBoots(b, items)).toBe(b); expect(repairBoots(c, items)).toBe(c);
  });
  it("is idempotent", () => { const once = repairBoots(row([3031], [3006, 3031]), items); expect(repairBoots(once, items)).toBe(once); });
});

describe("ADC build with the boots missing from the final inventory", () => {
  const adc = () => many(30, () => row([3031, 3036, 3094], [3006, 3031, 3036, 3094]));
  it("the boots take their slot in the build order (2nd, where they are bought), not missing", () => {
    expect(buildOrder(adc(), items)!.items.map((i) => i.id)).toEqual([3031, 3036, 3094]);   // the raw rows have no boots: that was the bug
    const b = computeBuild("Jinx", "BOTTOM", adc(), items);
    expect(b.buildOrder?.items.map((i) => i.id)).toEqual([3006, 3031, 3036, 3094]);
    expect(b.itemBlocks.find((x) => x.name === "Boots")?.items.map((i) => i.id)).toEqual([3006]);   // counted in the Boots block (the page lists boots that are in the order only there)
  });
  it("without a timeline nothing can be repaired, and nothing is invented", () => {
    const b = computeBuild("Jinx", "BOTTOM", many(30, () => row([3031, 3036, 3094], null)), items);
    expect(b.buildOrder ?? null).toBeNull(); expect(b.itemBlocks.flatMap((x) => x.items).some((i) => i.id === 3006)).toBe(false);
  });
  it("games whose final inventory already has boots (new collections) are unchanged", () => {
    const b = computeBuild("Jinx", "BOTTOM", many(30, () => row([3031, 3036, 3094, 3006], [3006, 3031, 3036, 3094])), items);
    expect(b.buildOrder?.items.map((i) => i.id)).toEqual([3006, 3031, 3036, 3094]);
  });
});

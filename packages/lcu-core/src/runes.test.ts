import { describe, expect, it } from "vitest";
import { buildRunePage, planApexRunePages, runePageFromStat, RUNE_PAGE_PREFIX, type RuneStyle } from "./runes";

const mk = (id: number, key: string): RuneStyle => ({ id, key, name: key, slots: [0, 1, 2, 3].map((r) => ({ runes: [0, 1, 2].map((i) => ({ id: id * 10 + r * 3 + i, name: "x" })) })) });
const styles = [mk(8000, "Precision"), mk(8100, "Domination"), mk(8200, "Sorcery"), mk(8300, "Inspiration"), mk(8400, "Resolve")];

describe("buildRunePage", () => {
  it("picks a tree by champion class and Inspiration as secondary", () => {
    const p = buildRunePage(styles, ["Mage"], "Ahri");
    expect([p.primaryStyleId, p.subStyleId]).toEqual([8200, 8300]);
    expect(p.name).toBe(`${RUNE_PAGE_PREFIX}Ahri`);
    expect(p.current).toBe(true);
  });
  it("returns 9 runes: 4 primary, 2 secondary from different rows, 3 shards", () => {
    const ids = buildRunePage(styles, ["Marksman"], "Jinx").selectedPerkIds;
    expect(ids).toHaveLength(9);
    expect(ids.slice(0, 4)).toEqual([80000, 80003, 80006, 80009]);
    expect(ids.slice(4, 6)).toEqual([83003, 83006]);
  });
  it("falls back to Precision for unknown classes", () => expect(buildRunePage(styles, [], "X").primaryStyleId).toBe(8000));
  it("keeps names within the client limit of 25 characters", () => expect(buildRunePage(styles, ["Mage"], "A".repeat(40)).name.length).toBeLessThanOrEqual(25));
  it("throws on incomplete rune data", () => expect(() => buildRunePage([{ ...mk(8000, "Precision"), slots: [] }, mk(8300, "Inspiration")], ["Fighter"], "Garen")).toThrow());
});

describe("runePageFromStat", () => {
  const stat = { primaryStyleId: 8000, subStyleId: 8300, perkIds: [8005, 8126, 8139, 8135, 8304, 8347, 5008, 5008, 5011] };
  it("turns a collected setup into a client rune page", () => {
    const p = runePageFromStat(stat, "Ahri");
    expect(p).toEqual({ name: `${RUNE_PAGE_PREFIX}Ahri`, primaryStyleId: 8000, subStyleId: 8300, selectedPerkIds: stat.perkIds.slice(), current: true });
  });
  it("rejects malformed data instead of sending it to the client", () => {
    expect(() => runePageFromStat({ ...stat, perkIds: stat.perkIds.slice(0, 8) }, "A")).toThrow();
    expect(() => runePageFromStat({ ...stat, perkIds: [8005, 8005, 8139, 8135, 8304, 8347, 5008, 5008, 5011] }, "A")).toThrow();
    expect(() => runePageFromStat({ ...stat, subStyleId: 8000 }, "A")).toThrow();
  });
});

describe("planApexRunePages", () => {
  const pg = (id: number, name: string, isEditable = true, current = false) => ({ id, name, isEditable, current });
  it("keeps the one Apex page and deletes no one when there is just one", () => {
    expect(planApexRunePages([pg(1, "My page"), pg(2, `${RUNE_PAGE_PREFIX}Ahri`)])).toEqual({ keep: 2, remove: [] });
  });
  it("with several Apex pages keeps the selected one (else the first) and removes the rest", () => {
    expect(planApexRunePages([pg(1, "Apex: Ahri"), pg(2, "Apex: Zed", true, true), pg(3, "Apex: Jinx")])).toEqual({ keep: 2, remove: [1, 3] });
    expect(planApexRunePages([pg(5, "Apex: A"), pg(6, "Apex: B")])).toEqual({ keep: 5, remove: [6] });
  });
  it("creates a page (keep null) when there is none, and never touches your own or locked pages", () => {
    expect(planApexRunePages([pg(1, "My page"), pg(2, "apex: lower"), pg(3, "Apex: Locked", false)])).toEqual({ keep: null, remove: [] });
  });
});

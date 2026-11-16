import { describe, expect, it } from "vitest";
import { DatabaseSync } from "./sqlite";
import { computeBuild, itemBlocks, runePages, spellPair, type BuildRow, type ItemMeta } from "./build";
import { makeStore, perksJson } from "./store";
import { matchFixture, participant } from "./testkit";

const perks = (p: number, keystone: number, s: number, extra: number[] = [8126, 8139, 8135], pair = [8304, 8347], shards = [5008, 5008, 5011]) =>
  JSON.stringify({ p, s, r: [keystone, ...extra, ...pair], h: shards });
const row = (over: Partial<BuildRow> = {}, win = 1): BuildRow => ({ perks: perks(8000, 8005, 8300), items: "[3157,3020]", spell1: 4, spell2: 14, win, ...over });
const items = new Map<number, ItemMeta>([[3157, { name: "Zhonya", total: 3250, hasUpgrade: false }], [3089, { name: "Rabadon", total: 3600, hasUpgrade: false }], [3020, { name: "Sorcerer's Shoes", total: 1100, hasUpgrade: false, boots: true }],
  [1001, { name: "Boots", total: 300, hasUpgrade: true, boots: true }], [1055, { name: "Doran's Blade", total: 450, hasUpgrade: true }], [3340, { name: "Ward", total: 0, hasUpgrade: false }], [3100, { name: "Lich Bane", total: 3000, hasUpgrade: false }]]);

describe("runePages", () => {
  it("groups games into setups, most played first, and counts wins per setup", () => {
    const rows = [row({}, 1), row({}, 0), row({}, 1), row({ perks: perks(8100, 8112, 8200) }, 1)];
    const pages = runePages(rows);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ primaryStyleId: 8000, subStyleId: 8300, games: 3, wins: 2 });
    expect(pages[1]).toMatchObject({ primaryStyleId: 8100, games: 1, wins: 1 });
  });
  it("returns 9 runes in client order: keystone + 3 primary, 2 secondary, 3 shards", () => {
    expect(runePages([row()])[0].perkIds).toEqual([8005, 8126, 8139, 8135, 8304, 8347, 5008, 5008, 5011]);
  });
  it("fills each primary row and shard with the most common choice within the setup", () => {
    const rows = [row({ perks: perks(8000, 8005, 8300, [8126, 8139, 8135], [8304, 8347], [5005, 5008, 5011]) }), row({ perks: perks(8000, 8005, 8300, [8126, 8138, 8135], [8304, 8347], [5008, 5008, 5011]) }),
      row({ perks: perks(8000, 8005, 8300, [8126, 8138, 8135], [8304, 8347], [5008, 5008, 5001]) })];
    const ids = runePages(rows)[0].perkIds;
    expect(ids[2]).toBe(8138); expect(ids[6]).toBe(5008); expect(ids[8]).toBe(5011);
  });
  it("takes the secondary runes as the most common real pair, whatever the order, so the page stays valid", () => {
    const rows = [row({ perks: perks(8000, 8005, 8300, undefined, [8304, 8347]) }), row({ perks: perks(8000, 8005, 8300, undefined, [8347, 8304]) }), row({ perks: perks(8000, 8005, 8300, undefined, [8304, 8352]) })];
    expect([...runePages(rows)[0].perkIds.slice(4, 6)].sort()).toEqual([8304, 8347]);
  });
  it("ignores games without a complete rune page and respects the limit", () => {
    expect(runePages([row({ perks: null }), row({ perks: "not json" }), row({ perks: JSON.stringify({ p: 1 }) })])).toEqual([]);
    const many = [8005, 8008, 8021, 8010, 9923].map((k) => row({ perks: perks(8000, k, 8300) }));
    expect(runePages(many, 2)).toHaveLength(2);
  });
});

describe("spellPair", () => {
  it("picks the most played pair and puts Flash on the second slot", () => {
    const p = spellPair([row({ spell1: 4, spell2: 14 }), row({ spell1: 14, spell2: 4 }, 0), row({ spell1: 4, spell2: 12 })])!;
    expect(p).toEqual({ ids: [14, 4], games: 2, wins: 1 });
  });
  it("is null without usable spell data", () => expect(spellPair([row({ spell1: null, spell2: null })])).toBeNull());
});

describe("itemBlocks", () => {
  const r = (list: number[], win = 1) => row({ items: JSON.stringify(list) }, win);
  it("separates boots, core and situational items by how often they are owned at the end", () => {
    const rows = [r([3157, 3089, 3100, 3020]), r([3157, 3089, 3020]), r([3157, 3100, 3020], 0)];
    const blocks = itemBlocks(rows, items);
    expect(blocks.map((b) => b.name)).toEqual(["Boots", "Core items"]);
    expect(blocks[0].items).toEqual([{ id: 3020, name: "Sorcerer's Shoes", games: 3, wins: 2 }]);
    expect(blocks[1].items.map((i) => i.id)).toEqual([3157, 3089, 3100]);
  });
  it("skips components, consumables, trinkets and base boots", () => {
    const blocks = itemBlocks([r([1055, 3340, 1001, 3157])], items);
    expect(blocks.flatMap((b) => b.items.map((i) => i.id))).toEqual([3157]);
  });
  it("counts a duplicated item once per game", () => expect(itemBlocks([r([3157, 3157])], items)[0].items[0].games).toBe(1));
  it("survives broken item data", () => expect(itemBlocks([row({ items: "oops" })], items)).toEqual([]));
});

describe("store + computeBuild", () => {
  it("stores the full rune page of every player", () => {
    expect(JSON.parse(perksJson(participant(0))!)).toEqual({ p: 8000, s: 8200, r: [8005, 8126, 8139, 8135, 8304, 8347], h: [5008, 5008, 5011] });
    expect(perksJson(participant(0, { perks: { styles: [{ selections: [{ perk: 1 }] }] } }))).toBeNull(); // the older, partial shape
  });
  it("builds from stored games, optionally for one role", () => {
    const s = makeStore(new DatabaseSync(":memory:"));
    for (let n = 0; n < 6; n++) s.saveMatch(matchFixture(`G${n}`, {}, n % 2 === 0), "EMERALD", "euw1");
    const b = computeBuild("Ahri", "TOP", s.buildRows("Ahri", {}, "TOP"), items);
    expect(b.games).toBe(6);
    expect(b.runePages[0]).toMatchObject({ games: 6, wins: 3, primaryStyleId: 8000 });
    expect(b.spells?.ids).toEqual([14, 4]);
    expect(computeBuild("Ahri", "MID", s.buildRows("Ahri", {}, "MID"), items).games).toBe(0);
  });
  it("adds the perks column to a database created by an older version and ignores its old games", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE participants (match_id TEXT NOT NULL, puuid TEXT, team INTEGER NOT NULL, champion TEXT NOT NULL, role TEXT, win INTEGER NOT NULL, keystone INTEGER,
      items TEXT NOT NULL, spell1 INTEGER, spell2 INTEGER, kills INTEGER, deaths INTEGER, assists INTEGER, cs INTEGER, damage INTEGER, gold INTEGER);
      INSERT INTO participants VALUES ('OLD', 'x', 100, 'Ahri', 'MID', 1, 8005, '[3157]', 4, 14, 1, 1, 1, 1, 1, 1);`);
    const s = makeStore(db);
    db.exec("INSERT INTO matches (id, patch, bracket, platform, ended_at, duration, blue_win) VALUES ('OLD', '16.20', 'EMERALD', 'euw1', 1, 1800, 1)");
    expect(s.buildRows("Ahri", {})).toHaveLength(1);
    expect(computeBuild("Ahri", null, s.buildRows("Ahri", {}), items).runePages).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { DatabaseSync } from "./sqlite";
import { computeBuild, itemBlocks, itemWpas, keystoneStats, lengthBand, runePages, spellPair, type BuildRow, type ItemMeta } from "./build";
import { makeStore, perksJson } from "./store";
import { matchFixture, participant } from "./testkit";

const perks = (p: number, keystone: number, s: number, extra: number[] = [8126, 8139, 8135], pair = [8304, 8347], shards = [5008, 5008, 5011]) =>
  JSON.stringify({ p, s, r: [keystone, ...extra, ...pair], h: shards });
const row = (over: Partial<BuildRow> = {}, win = 1): BuildRow => ({ perks: perks(8000, 8005, 8300), items: "[3157,3020]", spell1: 4, spell2: 14, win, ...over });
const items = new Map<number, ItemMeta>([[3157, { name: "Zhonya", total: 3250, hasUpgrade: false }], [3089, { name: "Rabadon", total: 3600, hasUpgrade: false }], [3020, { name: "Sorcerer's Shoes", total: 1100, hasUpgrade: true, boots: true }], [3998, { name: "Tier 3 Boots", total: 1850, hasUpgrade: false, boots: true }],
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
  it("lists up to three kinds of boots, most owned first, in the Boots block", () => {
    const ex = new Map(items); ex.set(3009, { name: "Swiftness", total: 1000, hasUpgrade: true, boots: true });
    const rows = [...Array.from({ length: 5 }, () => row({ items: JSON.stringify([3020, 3157]) })), ...Array.from({ length: 3 }, () => row({ items: JSON.stringify([3009, 3157]) }))];
    const boots = itemBlocks(rows, ex).find((b) => b.name === "Boots")!;
    expect(boots.items.map((i) => i.id)).toEqual([3020, 3009]);
  });
  it("leaves out boots that only a few games ended with (a mage's boots on an ADC), but always keeps the top two", () => {
    const ex = new Map(items); ex.set(3009, { name: "Swiftness", total: 1000, hasUpgrade: true, boots: true });
    const mk = (id: number, n: number) => Array.from({ length: n }, () => row({ items: JSON.stringify([id, 3157]) }));
    const boots = (rows: ReturnType<typeof row>[]) => itemBlocks(rows, ex).find((b) => b.name === "Boots")!.items.map((i) => i.id);
    expect(boots([...mk(3009, 80), ...mk(3998, 15), ...mk(3020, 2)])).toEqual([3009, 3998]);          // Sorcerer's Shoes: 2 of 97 games, dropped
    expect(boots([...mk(3009, 80), ...mk(3998, 3), ...mk(3020, 2)])).toEqual([3009, 3998]);            // the second kind stays even when small
    expect(boots([...mk(3009, 60), ...mk(3998, 30), ...mk(3020, 10)])).toEqual([3009, 3998, 3020]);   // 9% is a real option
  });
  it("skips components, consumables, trinkets and base boots", () => {
    const blocks = itemBlocks([r([1055, 3340, 1001, 3157])], items);
    expect(blocks.flatMap((b) => b.items.map((i) => i.id))).toEqual([3157]);
  });
  it("shows tier 2 boots even though they build into tier 3, and tier 3 boots too", () => {
    const blocks = itemBlocks([r([3157, 3020]), r([3157, 3020]), r([3157, 3998], 0)], items);
    expect(blocks[0].name).toBe("Boots");
    expect(blocks[0].items.map((i) => [i.id, i.games])).toEqual([[3020, 2], [3998, 1]]);
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

describe("itemWpas (Win Probability Added of items)", () => {
  const MIN = 60;
  /** n games of the given length with the given final items; `wins` of them won. */
  const games = (n: number, wins: number, itemIds: number[], minutes: number): BuildRow[] =>
    Array.from({ length: n }, (_, i) => row({ items: JSON.stringify(itemIds), duration: minutes * MIN }, i < wins ? 1 : 0));

  it("puts game lengths into 5 minute bands from under 20 to 35+", () => {
    expect([10, 19.9, 20, 27, 34.9, 35, 60].map((m) => lengthBand(m * MIN))).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });
  it("is positive for an item whose owners win more than games without it, in the same length band and item count", () => {
    const rows = [...games(300, 200, [3157, 3089], 30), ...games(300, 150, [3100, 3089], 30)];   // Zhonya 67% vs Lich Bane 50%, both with 2 finished items
    const w = itemWpas(rows, items);
    expect(w.get(3157)!.wpa).toBeGreaterThan(5); expect(w.get(3157)!.lo).toBeGreaterThan(0);
    expect(w.get(3100)!.wpa).toBeLessThan(-3);
    expect(w.get(3157)!.expected).toBeGreaterThan(0.45); expect(w.get(3157)!.expected).toBeLessThan(0.6);
  });
  it("does not credit an item for appearing in long games, which everyone wins more (no length bias)", () => {
    // Zhonya is owned mostly in 38 minute games (70% wins for everyone), Lich Bane mostly in 22 minute games (30% wins for everyone)
    const rows = [...games(400, 280, [3157, 3089], 38), ...games(40, 12, [3157, 3089], 22), ...games(400, 120, [3100, 3089], 22), ...games(40, 28, [3100, 3089], 38)];
    const w = itemWpas(rows, items);
    expect(Math.abs(w.get(3157)!.wpa)).toBeLessThan(1.5); expect(Math.abs(w.get(3100)!.wpa)).toBeLessThan(1.5);
  });
  it("covers boots and finished items only, and skips games without a length", () => {
    const rows = [...games(20, 10, [3157, 3020, 1055, 3340], 30), row({ items: "[3157]", duration: undefined })];
    const w = itemWpas(rows, items);
    expect([...w.keys()].sort()).toEqual([3020, 3157]);              // tier 2 boots (they build into tier 3) are included                  // not the Doran's Blade component or the ward
    expect(w.get(3157)!.expected).toBeGreaterThan(0);
    expect(itemWpas([row({ items: "[3157]" })], items).size).toBe(0);     // no duration at all: nothing to compare
  });
  it("shows a tiny sample as a small effect with a wide range", () => {
    const rows = [...games(500, 250, [3089, 3100], 30), ...games(3, 3, [3157, 3089], 30)];
    const z = itemWpas(rows, items).get(3157)!;
    expect(z.wpa).toBeGreaterThan(0); expect(z.wpa).toBeLessThan(4); expect(z.lo).toBeLessThan(0);
  });
  it("is attached to the item blocks and the build", () => {
    const rows = [...games(60, 40, [3157, 3089], 30), ...games(60, 30, [3100, 3089], 30)];
    const b = computeBuild("Ahri", null, rows, items);
    const all = b.itemBlocks.flatMap((x) => x.items);
    expect(all.find((i) => i.id === 3157)!.wpa).toMatchObject({ wpa: expect.any(Number), lo: expect.any(Number), hi: expect.any(Number), expected: expect.any(Number) });
  });
});

describe("one core row (no duplicate ordered / unordered core)", () => {
  // 12 timeline games: final inventory has three core items, bought Lich Bane -> Zhonya -> Rabadon; one extra item sits outside the core.
  const tl = (n: number, win = 1) => Array.from({ length: n }, () => row({ items: "[3157,3089,3100,3020]", buys: "[3100,3157,3089]" }, win));
  it("makes the Core block the build order, with per-item stats, and lists each item once", () => {
    const b = computeBuild("Ahri", null, [...tl(12), row({ items: "[3157,3020]" })], items);
    const core = b.itemBlocks.find((x) => x.name === "Core items")!;
    expect(core.ordered).toBe(true);
    expect(core.items.map((i) => i.id)).toEqual([3100, 3157, 3089]);
    expect(core.items.find((i) => i.id === 3157)).toMatchObject({ games: 13, wins: 13 });
    const ids = b.itemBlocks.flatMap((x) => x.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(b.corePath?.items.map((i) => i.id)).toEqual([3100, 3157, 3089]);
  });
  it("keeps a popularity-ordered Core block (not marked ordered) when there are too few timeline games", () => {
    const b = computeBuild("Ahri", null, tl(3), items);
    expect(b.corePath).toBeNull();
    expect(b.itemBlocks.find((x) => x.name === "Core items")!.ordered).toBeUndefined();
  });
  it("never repeats a core item in Situational", () => {
    const b = computeBuild("Ahri", null, tl(12), items);
    const sit = b.itemBlocks.find((x) => x.name === "Situational");
    expect(sit?.items.some((i) => [3100, 3157, 3089].includes(i.id)) ?? false).toBe(false);
  });
});

describe("keystone fallback when no game has a full rune page", () => {
  it("lists the most played keystones even if every perks value is missing", () => {
    const rows = [row({ perks: null, keystone: 8005 }), row({ perks: null, keystone: 8005 }, 0), row({ perks: null, keystone: 8112 })];
    expect(keystoneStats(rows)).toEqual([{ id: 8005, games: 2, wins: 1 }, { id: 8112, games: 1, wins: 1 }]);
    const b = computeBuild("Ahri", null, rows, items);
    expect(b.runePages).toEqual([]); expect(b.keystones[0]).toMatchObject({ id: 8005, games: 2 });
  });
  it("ignores games without a keystone", () => expect(keystoneStats([row({ perks: null, keystone: null })])).toEqual([]));
});

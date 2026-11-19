import { describe, expect, it } from "vitest";
import { buildPaletteEntries, championPath, profilePath, shouldOpenDraft } from "./nav";

const L = [
  { id: "Kaisa", name: "Kai'Sa" }, { id: "MonkeyKing", name: "Wukong" }, { id: "Draven", name: "Draven" }, { id: "Ahri", name: "Ahri" },
];
const label = (e: ReturnType<typeof buildPaletteEntries>[number]) =>
  e.kind === "page" ? `page:${e.item.label}` : e.kind === "champion" ? `champ:${e.champion.name}` : `${e.kind}:${e.riotId}`;

describe("buildPaletteEntries", () => {
  it("lists every page and no champions for an empty query", () => {
    const r = buildPaletteEntries("", L);
    expect(r.every((e) => e.kind === "page")).toBe(true);
    expect(r.map(label)).toContain("page:Settings");
    expect(r.map(label)).toContain("page:Tier List");
  });
  it("finds a champion case-, space- and apostrophe-insensitively and links to its page", () => {
    const r = buildPaletteEntries("kai sa", L);
    expect(r.map(label)).toEqual(["champ:Kai'Sa"]);
    expect(r[0].kind === "champion" && r[0].path).toBe("/champions/Kaisa");
  });
  it("finds Wukong by name and by its id; links with the id", () => {
    for (const q of ["wukong", "monkey"]) {
      const r = buildPaletteEntries(q, L);
      expect(r.map(label)).toEqual(["champ:Wukong"]);
      expect(r[0].kind === "champion" && r[0].path).toBe("/champions/MonkeyKing");
    }
  });
  it("puts pages before champions when both match", () => {
    const r = buildPaletteEntries("dra", L).map(label);
    expect(r).toEqual(["page:Draft", "champ:Draven"]);
  });
  it("matches pages ignoring spaces", () => expect(buildPaletteEntries("tierlist", L).map(label)).toEqual(["page:Tier List"]));
  it("works before champions have loaded and returns nothing for no match", () => {
    expect(buildPaletteEntries("ahri", undefined)).toEqual([]);
    expect(buildPaletteEntries("zzzz", L)).toEqual([]);
  });
  it("keys are unique and the champion limit applies", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `Ax${i}`, name: `Ax${i}` }));
    const r = buildPaletteEntries("ax", many, { championLimit: 3 });
    expect(r).toHaveLength(3);
    const all = buildPaletteEntries("", L);
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length);
  });
  it("encodes odd ids in the route", () => expect(championPath("A B")).toBe("/champions/A%20B"));
});

describe("buildPaletteEntries: players", () => {
  const o = { favourites: ["Faker#KR1"], recent: ["faker#kr1", "Doublelift#NA1", "Caps#EUW"] };
  it("lists favourites then new recents after the pages when the query is empty, without duplicates", () => {
    const r = buildPaletteEntries("", L, o).filter((e) => e.group === "Players");
    expect(r.map(label)).toEqual(["player:Faker#KR1", "player:Doublelift#NA1", "player:Caps#EUW"]);
    expect(r[0].kind === "player" && r[0].favourite).toBe(true);
    expect(r[1].kind === "player" && r[1].favourite).toBe(false);
  });
  it("filters players by the typed text, ignoring case and punctuation", () => {
    expect(buildPaletteEntries("DOUBLE lift", L, o).map(label)).toEqual(["player:Doublelift#NA1"]);
    expect(buildPaletteEntries("kr1", L, o).map(label)).toEqual(["player:Faker#KR1"]);
  });
  it("offers a lookup row for a full Riot ID, first, and shows only players", () => {
    // A one-character tag is not yet a Riot ID, so there is no lookup row, only the matching known player.
    expect(buildPaletteEntries("Caps#E", L, o).map(label)).toEqual(["player:Caps#EUW"]);
    // "Caps#EU" is already a valid Riot ID: lookup first, then the known player it is a prefix of.
    expect(buildPaletteEntries("Caps#EU", L, o).map(label)).toEqual(["lookup:Caps#EU", "player:Caps#EUW"]);
    const full = buildPaletteEntries("New Guy#EUW", L, o);
    expect(full.map(label)).toEqual(["lookup:New Guy#EUW"]);
    expect(full[0].kind === "lookup" && full[0].path).toBe(profilePath("New Guy#EUW"));
    expect(profilePath("New Guy#EUW")).toBe("/profile/New%20Guy%23EUW");
  });
  it("does not offer a second lookup row for a known player, but still lists them", () => {
    expect(buildPaletteEntries("faker#kr1", L, o).map(label)).toEqual(["player:Faker#KR1"]);
  });
  it("limits players and keeps keys unique", () => {
    const many = Array.from({ length: 20 }, (_, i) => `P${i}#EUW`);
    const r = buildPaletteEntries("", L, { recent: many, playerLimit: 3 }).filter((e) => e.group === "Players");
    expect(r).toHaveLength(3);
    const all = buildPaletteEntries("", L, o);
    expect(new Set(all.map((e) => e.key)).size).toBe(all.length);
  });
  it("works without options", () => expect(buildPaletteEntries("zzzz", L)).toEqual([]));
});

describe("buildPaletteEntries: stored players", () => {
  const o = { favourites: ["Faker#KR1"], recent: ["Caps#EUW"], stored: ["caps#euw", "Chovy#KR1", "Faker#KR1"] };
  it("lists stored players after favourites and recents, each Riot ID once", () => {
    const r = buildPaletteEntries("", L, o).filter((e) => e.group === "Players");
    expect(r.map(label)).toEqual(["player:Faker#KR1", "player:Caps#EUW", "player:Chovy#KR1"]);
  });
  it("filters them by the typed text like the other players", () => {
    expect(buildPaletteEntries("chov", L, o).map(label)).toEqual(["player:Chovy#KR1"]);
  });
  it("no lookup row for a full Riot ID that is already stored; one for an unknown ID", () => {
    expect(buildPaletteEntries("chovy#kr1", L, o).map(label)).toEqual(["player:Chovy#KR1"]);
    expect(buildPaletteEntries("Nobody#EUW", L, o).map(label)).toEqual(["lookup:Nobody#EUW"]);
  });
  it("stored players count toward the player limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => `S${i}#EUW`);
    expect(buildPaletteEntries("", L, { stored: many, playerLimit: 4 }).filter((e) => e.group === "Players")).toHaveLength(4);
  });
});

describe("shouldOpenDraft", () => {
  it("opens the Draft page when champ select starts", () => expect(shouldOpenDraft(false, true, true, "/champions")).toBe(true));
  it("does nothing when the setting is off", () => expect(shouldOpenDraft(false, true, false, "/")).toBe(false));
  it("fires only on the start, not while the draft runs or when it ends", () => {
    expect(shouldOpenDraft(true, true, true, "/")).toBe(false);
    expect(shouldOpenDraft(true, false, true, "/")).toBe(false);
  });
  it("stays put when already on the Draft page", () => expect(shouldOpenDraft(false, true, true, "/draft")).toBe(false));
});

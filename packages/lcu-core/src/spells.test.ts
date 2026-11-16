import { describe, expect, it } from "vitest";
import type { Role } from "@apex/schema";
import { SPELLS, SPELL_NAMES, parseSummonerSpells, placeFlash, recommendSpells } from "./spells";
import { SHARD_ICONS, SHARD_NAMES } from "./runes";

describe("recommendSpells", () => {
  const roles: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  it("always returns two different spells with Flash second", () => {
    for (const r of roles) { const [a, b] = recommendSpells(r); expect(a).not.toBe(b); expect(b).toBe(SPELLS.Flash); }
  });
  it("gives junglers Smite and toplaners Teleport", () => {
    expect(recommendSpells("JUNGLE")[0]).toBe(SPELLS.Smite);
    expect(recommendSpells("TOP")[0]).toBe(SPELLS.Teleport);
  });
  it("falls back to a sensible default when the role is unknown", () => expect(recommendSpells(null)).toEqual([SPELLS.Ignite, SPELLS.Flash]));
  it("can name every spell", () => expect(SPELL_NAMES[SPELLS.Flash]).toBe("Flash"));
});

describe("placeFlash", () => {
  const { Flash, Ignite, Smite, Teleport } = SPELLS;
  it("leaves Flash on F (second slot) unchanged", () => expect(placeFlash([Ignite, Flash], "F")).toEqual([Ignite, Flash]));
  it("moves Flash to D (first slot)", () => expect(placeFlash([Ignite, Flash], "D")).toEqual([Flash, Ignite]));
  it("also puts Flash on F when it arrives first", () => expect(placeFlash([Flash, Ignite], "F")).toEqual([Ignite, Flash]));
  it("does not reorder a pair without Flash", () => {
    expect(placeFlash([Smite, Teleport], "D")).toEqual([Smite, Teleport]);
    expect(placeFlash([Smite, Teleport], "F")).toEqual([Smite, Teleport]);
  });
  it("keeps both spells and does not mutate its input", () => {
    const pair: [number, number] = [Teleport, Flash], out = placeFlash(pair, "D");
    expect([...out].sort()).toEqual([...pair].sort()); expect(pair).toEqual([Teleport, Flash]);
  });
  it("works with every role default", () => {
    for (const r of ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as Role[]) expect(placeFlash(recommendSpells(r), "D")[0]).toBe(Flash);
  });
});

describe("parseSummonerSpells", () => {
  const json = { data: { SummonerFlash: { key: "4", name: "Flash", image: { full: "SummonerFlash.png" } }, SummonerDot: { key: "14", name: "Ignite", image: { full: "SummonerDot.png" } },
    Broken1: { key: "x", name: "Nope", image: { full: "a.png" } }, Broken2: { key: "9", name: "NoImage" }, Broken3: null } };
  it("maps the client's numeric id to name and icon file and skips malformed entries", () => {
    const m = parseSummonerSpells(json);
    expect([...m.keys()].sort((a, b) => a - b)).toEqual([4, 14]);
    expect(m.get(14)).toEqual({ id: 14, name: "Ignite", image: "SummonerDot.png" });
  });
  it("survives garbage input", () => { expect(parseSummonerSpells(null).size).toBe(0); expect(parseSummonerSpells({}).size).toBe(0); expect(parseSummonerSpells("x").size).toBe(0); });
  it("knows every spell id Apex itself uses (names exist for them)", () => { for (const id of Object.values(SPELLS)) expect(SPELL_NAMES[id]).toBeTruthy(); });
});

describe("shard icons", () => {
  it("has an icon file for every named shard and none for unknown ids", () => {
    expect(Object.keys(SHARD_ICONS).sort()).toEqual(Object.keys(SHARD_NAMES).sort());
    for (const f of Object.values(SHARD_ICONS)) expect(f).toMatch(/^perk-images\/StatMods\/StatMods\w+Icon\.png$/);
  });
});

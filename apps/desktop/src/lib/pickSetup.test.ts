import { describe, expect, it } from "vitest";
import type { ChampionBuild } from "@apex/schema";
import { resolveSetup } from "./pickSetup";

const rune = (games: number, id: number) => ({ primaryStyleId: id, subStyleId: 8000, perkIds: [id], games, wins: Math.floor(games / 2) });
const pair = (games: number, a: number) => ({ ids: [a, 4], games, wins: Math.floor(games / 2) });
const core = (games: number, base: number) => ({ games, wins: games / 2, runePages: [rune(games, base), rune(5, base + 1)], spellPairs: [pair(games, 14), pair(3, 12)] });
const build = (v?: boolean) => (v
  ? ({ ...core(60, 1), variants: [{ id: "ap", games: 200, wins: 110, build: core(200, 10) }, { id: "ad", games: 40, wins: 20, build: core(40, 20) }] })
  : core(60, 1)) as unknown as ChampionBuild;

describe("resolveSetup", () => {
  it("has nothing without a build", () => expect(resolveSetup(null, { runePage: 1 })).toEqual({ variantId: null, core: null, rune: null, spell: null }));
  it("defaults to the top rune page and spell pair when they have enough games", () => {
    const r = resolveSetup(build());
    expect(r.rune?.primaryStyleId).toBe(1);
    expect(r.spell?.ids).toEqual([14, 4]);
    expect(r.variantId).toBeNull();
  });
  it("uses no data default below the minimum, but honours an explicit choice of a small sample", () => {
    const small = { ...core(4, 1), variants: undefined } as unknown as ChampionBuild;
    expect(resolveSetup(small).rune).toBeNull();
    expect(resolveSetup(small).spell).toBeNull();
    expect(resolveSetup(small, { runePage: 0, spellPair: 1 }).rune?.primaryStyleId).toBe(1);
    expect(resolveSetup(small, { runePage: 0, spellPair: 1 }).spell?.ids).toEqual([12, 4]);
  });
  it("picks the n-th page of the chosen build type", () => {
    const r = resolveSetup(build(true), { variantId: "ad", runePage: 1, spellPair: 1 });
    expect(r.variantId).toBe("ad");
    expect(r.rune?.primaryStyleId).toBe(21);
    expect(r.spell?.ids).toEqual([12, 4]);
  });
  it("falls back to the best build type and the defaults for unknown or out-of-range choices", () => {
    const r = resolveSetup(build(true), { variantId: "gone", runePage: 9, spellPair: -1 });
    expect(r.variantId).toBe("ap");
    expect(r.rune?.primaryStyleId).toBe(10);
    expect(r.spell?.ids).toEqual([14, 4]);
    expect(resolveSetup(build(), { runePage: 1.5 }).rune?.primaryStyleId).toBe(1);
  });
});

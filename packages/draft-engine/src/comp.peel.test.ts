import { describe, expect, it } from "vitest";
import { MIN_PEEL_GAMES, teamComp, teamPeel, type CompProfile } from "./comp";
import { createRealData } from "./real";
import type { Pick } from "./engine";
import type { DraftStats } from "@apex/schema";

const base = { games: 100, phys: 6000, magic: 3000, trueDmg: 1000, taken: 20000, cc: 30, seconds: 6000 };
/** `heals`/`shields` summed over `peelGames` games of `peelSeconds`; 1 heal+shield per second here = 60 per minute. */
const withPeel = (peelGames: number, heals = 3000, shields = 3000, peelSeconds = 6000): CompProfile => ({ ...base, peelGames, heals, shields, peelSeconds });
const picks = (...ids: number[]): Pick[] => ids.map((champion) => ({ champion, role: "MID" }) as Pick);
const tags = () => ["Mage"];

describe("teamPeel", () => {
  it("sums heals + shields per minute over the picks and reports the fewest games behind a pick", () => {
    const r = teamPeel([withPeel(80), withPeel(30, 6000, 0, 3000)]);                  // 60/min + 120/min
    expect(r).toEqual({ peelPerMin: 180, peelGames: 30 });
  });
  it("is not measured when any pick lacks Peel data or has fewer than MIN_PEEL_GAMES games (never 0)", () => {
    expect(teamPeel([withPeel(80), base])).toEqual({ peelPerMin: null, peelGames: 0 });                 // a pick without the fields
    expect(teamPeel([withPeel(80), withPeel(MIN_PEEL_GAMES - 1)])).toEqual({ peelPerMin: null, peelGames: 0 });
    expect(teamPeel([withPeel(80), null])).toEqual({ peelPerMin: null, peelGames: 0 });
    expect(teamPeel([])).toEqual({ peelPerMin: null, peelGames: 0 });
  });
  it("a measured zero (a team that never heals) is a number, not missing", () => {
    expect(teamPeel([withPeel(50, 0, 0)])).toEqual({ peelPerMin: 0, peelGames: 50 });
  });
});

describe("teamComp with Peel", () => {
  it("adds peelPerMin and peelGames to the team, independent of the damage split being measured", () => {
    const lookup = (c: number) => (c === 1 ? withPeel(60) : c === 2 ? { ...base } : null);
    const full = teamComp(picks(1, 1), lookup, tags);
    expect(full.measured).toBe(true); expect(full.peelPerMin).toBe(120); expect(full.peelGames).toBe(60);
    const mixed = teamComp(picks(1, 2), lookup, tags);                                  // damage measured, Peel not
    expect(mixed.measured).toBe(true); expect(mixed.peelPerMin).toBeNull(); expect(mixed.peelGames).toBe(0);
    const unmeasured = teamComp(picks(1, 3), lookup, tags);                             // class-tag estimate, still no invented Peel
    expect(unmeasured.measured).toBe(false); expect(unmeasured.peelPerMin).toBeNull();
  });
});

describe("createRealData keeps Peel fields", () => {
  const stats = { champions: [{ id: "Ahri", games: 100, wins: 50, roles: ["MID"] }], matchups: [], synergies: [], patch: "26.22",
    profiles: [{ id: "Ahri", role: "MID", ...withPeel(40) }, { id: "Ahri", role: "TOP", ...base }] } as unknown as DraftStats;
  it("passes a role's Peel sums through, so teamComp can use them", () => {
    const d = createRealData(stats, new Map([["Ahri", 103]]), () => ["Mage"]);
    expect(d.profile?.(103, "MID")).toMatchObject({ peelGames: 40, heals: 3000, shields: 3000, peelSeconds: 6000 });
    expect(d.profile?.(103, "TOP")).not.toHaveProperty("peelGames");
  });
});

import { describe, expect, it } from "vitest";
import { roleCounts } from "./liveRoleHistory";
import type { RiotMatch } from "./riot";

const m = (puuid: string, teamPosition: string): RiotMatch => ({ info: { participants: [{ puuid, teamPosition }, { puuid: "other", teamPosition: "TOP" }] } }) as unknown as RiotMatch;

describe("roleCounts", () => {
  it("counts the roles of one player and skips games without a position", () =>
    expect(roleCounts([m("a", "BOTTOM"), m("a", "BOTTOM"), m("a", "UTILITY"), m("a", ""), m("b", "TOP")], "a")).toEqual({ riotId: "", games: 3, roles: { ADC: 2, SUPPORT: 1 } }));
  it("returns no games for an empty history", () => expect(roleCounts([], "a")).toEqual({ riotId: "", games: 0, roles: {} }));
});

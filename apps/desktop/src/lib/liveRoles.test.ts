import { describe, expect, it } from "vitest";
import { assignRoles, sortByRole, type RoleCandidate } from "./liveRoles";

const c = (roles: RoleCandidate["roles"], smite = false): RoleCandidate => ({ roles, smite });

describe("assignRoles", () => {
  it("gives each player their most played role when they do not clash", () =>
    expect(assignRoles([c(["TOP"]), c(["JUNGLE"], true), c(["MID"]), c(["ADC"]), c(["SUPPORT"])])).toEqual(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]));
  it("resolves a clash by the best total fit (a flex pick takes the role the others cannot)", () =>
    expect(assignRoles([c(["MID", "TOP"]), c(["MID"]), c(["JUNGLE"], true), c(["ADC"]), c(["SUPPORT"])])).toEqual(["TOP", "MID", "JUNGLE", "ADC", "SUPPORT"]));
  it("Smite decides the jungle, even for a champion never seen there", () => {
    const r = assignRoles([c(["TOP"]), c(["MID"], true), c(["MID"]), c(["ADC"]), c(["SUPPORT"])]);
    expect(r[1]).toBe("JUNGLE"); expect(new Set(r).size).toBe(5);
  });
  it("works with unknown champions and always uses all five roles once", () => expect(new Set(assignRoles([c([]), c([]), c([]), c([]), c([])])).size).toBe(5));
  it("gives no roles when the team is not five (ARAM, custom)", () => expect(assignRoles([c(["MID"]), c(["TOP"])])).toEqual([null, null]));
});

describe("sortByRole", () => {
  it("orders top, jungle, mid, bot, support", () => {
    const team = [{ n: "sup", r: "SUPPORT" }, { n: "mid", r: "MID" }, { n: "top", r: "TOP" }, { n: "adc", r: "ADC" }, { n: "jg", r: "JUNGLE" }] as const;
    expect(sortByRole(team, (p) => p.r).map((p) => p.n)).toEqual(["top", "jg", "mid", "adc", "sup"]);
  });
  it("keeps the given order when no role is known (ARAM, custom), and puts unknown roles last, stably", () => {
    const aram = [{ n: "a", r: null }, { n: "b", r: null }, { n: "c", r: null }] as const;
    expect(sortByRole(aram, (p) => p.r).map((p) => p.n)).toEqual(["a", "b", "c"]);
    const mixed = [{ n: "x", r: null }, { n: "y", r: "MID" }, { n: "z", r: null }, { n: "w", r: "TOP" }] as const;
    expect(sortByRole(mixed, (p) => p.r).map((p) => p.n)).toEqual(["w", "y", "x", "z"]);
  });
  it("does not change the input array", () => {
    const team = [{ r: "MID" }, { r: "TOP" }] as const; sortByRole(team, (p) => p.r);
    expect(team.map((p) => p.r)).toEqual(["MID", "TOP"]);
  });
});

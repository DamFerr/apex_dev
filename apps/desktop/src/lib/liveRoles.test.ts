import { describe, expect, it } from "vitest";
import { assignRoles, roleFit, sortByRole, type RoleCandidate } from "./liveRoles";

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

describe("assignRoles with summoner spells", () => {
  const EXHAUST = 3, HEAL = 7, TP = 12, FLASH = 4, IGNITE = 14;
  const cs = (roles: RoleCandidate["roles"], spells: number[], smite = false): RoleCandidate => ({ roles, smite, spells });
  // Illustrative pools (Yone mid/top, Yasuo mid/bot/top/support, Shen top/support). Without spells the best fit is Yone top, Shen support, Yasuo bot.
  const red = (sp: number[][]) => assignRoles([cs(["MID", "TOP", "ADC"], sp[0]), cs(["JUNGLE"], [11, FLASH], true), cs(["MID"], sp[2]), cs(["MID", "ADC", "TOP", "SUPPORT"], sp[3]), cs(["TOP", "SUPPORT"], sp[4])]);
  it("without spells the pooled roles give the usual fit", () => expect(red([[], [], [], [], []])).toEqual(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]));
  it("lets Heal and Exhaust move an off-meta flex pick to bot and support", () =>
    expect(red([[HEAL, FLASH], [], [FLASH, IGNITE], [EXHAUST, FLASH], [FLASH, IGNITE]])).toEqual(["ADC", "JUNGLE", "MID", "SUPPORT", "TOP"]));
  it("does not override a clear champion fit with a weak spell", () =>
    expect(assignRoles([cs(["TOP"], [FLASH, IGNITE]), cs(["JUNGLE"], [11, FLASH], true), cs(["MID"], [FLASH, IGNITE]), cs(["ADC"], [FLASH, IGNITE]), cs(["SUPPORT"], [FLASH, IGNITE])])).toEqual(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]));
  it("gives the same result without spells as before (spells optional)", () =>
    expect(assignRoles([c(["MID", "TOP"]), c(["MID"]), c(["JUNGLE"], true), c(["ADC"]), c(["SUPPORT"])])).toEqual(["TOP", "MID", "JUNGLE", "ADC", "SUPPORT"]));
});

describe("assignRoles with the players' own role history", () => {
  const h = (roles: RoleCandidate["roles"], history: RoleCandidate["history"], smite = false): RoleCandidate => ({ roles, smite, history });
  // The owner's game: Yone (pool mid/top), Yasuo (mid/top/bot/support), Shen (top/support); Shaco jungle, Veigar mid. Without history: Yone top, Yasuo bot, Shen support.
  const team = (hy: RoleCandidate["history"], ya: RoleCandidate["history"], sh: RoleCandidate["history"]) => assignRoles([
    h(["MID", "TOP", "ADC"], hy), h(["JUNGLE"], undefined, true), h(["MID"], undefined), h(["MID", "TOP", "ADC", "SUPPORT"], ya), h(["TOP", "SUPPORT"], sh)]);
  it("puts flex picks where the players actually played: Shen top, Yone bot, Yasuo support", () =>
    expect(team({ games: 5, roles: { ADC: 5 } }, { games: 5, roles: { SUPPORT: 4, MID: 1 } }, { games: 5, roles: { TOP: 5 } })).toEqual(["ADC", "JUNGLE", "MID", "SUPPORT", "TOP"]));
  it("ignores a history of fewer than 2 games", () =>
    expect(team({ games: 1, roles: { ADC: 1 } }, { games: 1, roles: { SUPPORT: 1 } }, { games: 1, roles: { TOP: 1 } })).toEqual(["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"]));
  it("still lets Smite decide the jungle against a contrary history", () => {
    const r = assignRoles([h(["TOP"], { games: 5, roles: { JUNGLE: 5 } }), h(["MID"], undefined, true), h(["MID"], undefined), h(["ADC"], undefined), h(["SUPPORT"], undefined)]);
    expect(r[1]).toBe("JUNGLE"); expect(r[0]).not.toBe("JUNGLE");
  });
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

describe("roleFit", () => {
  const hist = { games: 10, roles: { MID: 6, TOP: 3 } as Partial<Record<"MID" | "TOP", number>> };
  it("is main for the most played role and off for any other", () => {
    expect(roleFit("MID", hist)).toBe("main");
    expect(roleFit("TOP", hist)).toBe("off");
    expect(roleFit("SUPPORT", hist)).toBe("off");
  });
  it("counts a tie for the most played role as main", () => {
    expect(roleFit("MID", { games: 6, roles: { MID: 3, TOP: 3 } })).toBe("main");
    expect(roleFit("TOP", { games: 6, roles: { MID: 3, TOP: 3 } })).toBe("main");
  });
  it("says nothing without enough history or without any recorded role", () => {
    expect(roleFit("MID", undefined)).toBeNull();
    expect(roleFit("MID", { games: 1, roles: { MID: 1 } })).toBeNull();
    expect(roleFit("MID", { games: 8, roles: {} })).toBeNull();
  });
});

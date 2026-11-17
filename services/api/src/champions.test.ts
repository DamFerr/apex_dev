import { describe, expect, it } from "vitest";
import { canonicalChampionId, resolveChampionId, RIOT_CHAMPION_ALIASES } from "./champions";

describe("champion ids", () => {
  it("turns Riot's FiddleSticks into the Data Dragon id and leaves every other id alone", () => {
    expect(canonicalChampionId("FiddleSticks")).toBe("Fiddlesticks");
    for (const id of ["Fiddlesticks", "Ahri", "MonkeyKing", "DrMundo", "Velkoz", "Kaisa", "Belveth", "Chogath", "Leblanc", "Nunu", "Renata"]) expect(canonicalChampionId(id)).toBe(id);
  });
  it("every alias points at an id that differs from Riot's spelling only in upper/lower case or not at all", () => {
    for (const [riot, dd] of Object.entries(RIOT_CHAMPION_ALIASES)) expect(dd.toLowerCase()).toBe(riot.toLowerCase());
  });
  it("finds the Data Dragon spelling ignoring case, and falls back to the id it was given", () => {
    const dd = ["Ahri", "Fiddlesticks", "MonkeyKing"];
    expect(resolveChampionId("FiddleSticks", dd)).toBe("Fiddlesticks");
    expect(resolveChampionId("fiddlesticks", dd)).toBe("Fiddlesticks");
    expect(resolveChampionId("monkeyking", dd)).toBe("MonkeyKing");
    expect(resolveChampionId("Brandnew", dd)).toBe("Brandnew");
  });
});

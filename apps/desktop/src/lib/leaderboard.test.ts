import { describe, expect, it } from "vitest";
import { defaultRegion, pageCount, pageLabel } from "./leaderboard";

const known = ["euw1", "na1", "kr"];

describe("pageCount", () => {
  it("rounds up and never goes below one page", () => {
    expect(pageCount(300)).toBe(6); expect(pageCount(301)).toBe(7); expect(pageCount(1)).toBe(1); expect(pageCount(0)).toBe(1);
  });
});

describe("pageLabel", () => {
  it("shows the range of the page, or none for an empty list", () => {
    expect(pageLabel(0, 50, 300)).toBe("1–50 of 300"); expect(pageLabel(250, 50, 300)).toBe("251–300 of 300");
    expect(pageLabel(0, 0, 0)).toBe("0 players");
  });
});

describe("defaultRegion", () => {
  it("prefers the player's own region, then the stats filter, then Europe West", () => {
    expect(defaultRegion("na1", "kr", known)).toBe("na1");
    expect(defaultRegion(undefined, "kr", known)).toBe("kr");
    expect(defaultRegion(undefined, "all", known)).toBe("euw1");
  });
  it("skips regions the backend does not serve", () => expect(defaultRegion("xx1", "yy1", known)).toBe("euw1"));
});

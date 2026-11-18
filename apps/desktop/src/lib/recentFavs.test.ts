import { describe, expect, it } from "vitest";
import { FAVOURITE_CAP, RECENT_CAP, isFavourite, pushRecent, removeFromList, toggleFavourite } from "./recentFavs";

describe("pushRecent", () => {
  it("puts the newest first", () => expect(pushRecent(["A#1", "B#2"], "C#3")).toEqual(["C#3", "A#1", "B#2"]));
  it("moves a repeat to the front, ignoring case, and keeps the new spelling", () => {
    expect(pushRecent(["A#1", "Faker#KR1", "B#2"], "faker#kr1")).toEqual(["faker#kr1", "A#1", "B#2"]);
  });
  it("trims and ignores blank ids", () => {
    expect(pushRecent(["A#1"], "  B#2  ")).toEqual(["B#2", "A#1"]);
    expect(pushRecent(["A#1"], "   ")).toEqual(["A#1"]);
  });
  it("caps the list (default 5, custom cap, 0)", () => {
    const l = ["1#a", "2#a", "3#a", "4#a", "5#a"];
    expect(pushRecent(l, "6#a")).toEqual(["6#a", "1#a", "2#a", "3#a", "4#a"]);
    expect(RECENT_CAP).toBe(5);
    expect(pushRecent(l, "6#a", 2)).toEqual(["6#a", "1#a"]);
    expect(pushRecent(l, "6#a", 0)).toEqual([]);
  });
  it("does not mutate its input", () => {
    const l = ["A#1"]; pushRecent(l, "B#2"); expect(l).toEqual(["A#1"]);
  });
});

describe("favourites", () => {
  it("toggles on and off, ignoring case", () => {
    const on = toggleFavourite(["A#1"], "Faker#KR1");
    expect(on).toEqual(["Faker#KR1", "A#1"]);
    expect(isFavourite(on, "faker#kr1")).toBe(true);
    expect(toggleFavourite(on, "FAKER#kr1")).toEqual(["A#1"]);
  });
  it("ignores blank ids and unknown removals", () => {
    expect(toggleFavourite(["A#1"], " ")).toEqual(["A#1"]);
    expect(removeFromList(["A#1"], "zzz#1")).toEqual(["A#1"]);
    expect(removeFromList(["A#1", "B#2"], "a#1")).toEqual(["B#2"]);
  });
  it("drops the oldest favourite at the cap", () => {
    const full = Array.from({ length: FAVOURITE_CAP }, (_, i) => `P${i}#EUW`);
    const next = toggleFavourite(full, "New#EUW");
    expect(next).toHaveLength(FAVOURITE_CAP);
    expect(next[0]).toBe("New#EUW");
    expect(isFavourite(next, `P${FAVOURITE_CAP - 1}#EUW`)).toBe(false);
  });
});

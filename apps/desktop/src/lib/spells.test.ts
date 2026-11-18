import { describe, expect, it } from "vitest";
import { displaySpells } from "./spells";

describe("displaySpells", () => {
  it("puts Flash (4) on the left, whatever order the pair came in", () => {
    expect(displaySpells([14, 4])).toEqual([4, 14]);
    expect(displaySpells([4, 14])).toEqual([4, 14]);
  });
  it("leaves pairs without Flash, and odd lengths, as they are", () => {
    expect(displaySpells([11, 12])).toEqual([11, 12]);
    expect(displaySpells([12, 11])).toEqual([12, 11]);
    expect(displaySpells([])).toEqual([]);
    expect(displaySpells([4])).toEqual([4]);
  });
});

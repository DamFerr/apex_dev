import { describe, expect, it } from "vitest";
import { summarizeImport } from "./importSummary";

describe("summarizeImport", () => {
  it("lists what was written in one line", () => {
    const r = summarizeImport([{ step: "runes", done: "rune page" }, { step: "spells", done: "spells Flash + Ignite" }, { step: "items", done: "2 item sets" }]);
    expect(r).toEqual({ message: "Imported rune page, spells Flash + Ignite and 2 item sets", errors: [] });
  });
  it("labels defaults as estimates", () => {
    expect(summarizeImport([{ step: "runes", done: "rune page", defaults: true }, { step: "spells", done: "spells", defaults: true }]).message)
      .toBe("Imported rune page and spells · defaults used for runes and spells (not enough collected games)");
  });
  it("mentions a skipped item set without calling it an error", () => {
    const r = summarizeImport([{ step: "runes", done: "rune page" }, { step: "items", skipped: true }]);
    expect(r.message).toBe("Imported rune page · item sets skipped (not enough games)"); expect(r.errors).toEqual([]);
  });
  it("says nothing was imported when everything was skipped", () => expect(summarizeImport([{ step: "items", skipped: true }]).message).toBe("Nothing imported · item sets skipped (not enough games)"));
  it("reports failures separately and keeps the successes", () => {
    const r = summarizeImport([{ step: "runes", error: "no client" }, { step: "spells", done: "spells Flash + Ignite" }]);
    expect(r.message).toBe("Imported spells Flash + Ignite"); expect(r.errors).toEqual(["Runes import failed: no client"]);
  });
  it("has no message when there is nothing to say", () => { expect(summarizeImport([]).message).toBeNull(); expect(summarizeImport([{ step: "items", error: "x" }]).message).toBeNull(); });
});

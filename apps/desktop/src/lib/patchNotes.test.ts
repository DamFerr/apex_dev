import { describe, expect, it } from "vitest";
import { patchNotesUrl } from "./patchNotes";

describe("patchNotesUrl", () => {
  it("builds Riot's notes URL from a public patch number (the pattern seen for 26.12, 26.16, 26.21, 26.22)", () => {
    expect(patchNotesUrl("26.22")).toBe("https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-22-notes/");
    expect(patchNotesUrl("26.12")).toBe("https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-12-notes/");
  });
  it("writes a single-digit minor without a leading zero", () => expect(patchNotesUrl("26.05")).toContain("patch-26-5-notes/"));
  it("returns null for anything that is not major.minor, so no broken link is ever shown", () => {
    for (const bad of ["all", "latest", "", "26", "26.22.1", "26.x", "../26.22", "26.22/evil", " 26.22"]) expect(patchNotesUrl(bad)).toBeNull();
    expect(patchNotesUrl(null)).toBeNull(); expect(patchNotesUrl(undefined)).toBeNull();
  });
});

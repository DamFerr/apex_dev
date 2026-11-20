/**
 * Riot's official League of Legends patch notes. URL pattern checked on Nov 20 2026 against Riot's own pages for patches 26.12, 26.16, 26.21
 * and 26.22: `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-<major>-<minor>-notes/` (dots become dashes).
 * Single-digit minors are written without a leading zero (assumed, not checked for 2026). Riot can change this pattern: re-check it if a link 404s.
 */
export const PATCH_NOTES_BASE = "https://www.leagueoflegends.com/en-us/news/game-updates/";

/** The notes page of a public patch such as "26.22", or null for anything else ("all", "latest", empty). Pure. */
export function patchNotesUrl(patch: string | null | undefined): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(patch ?? "");
  return m ? `${PATCH_NOTES_BASE}league-of-legends-patch-${Number(m[1])}-${Number(m[2])}-notes/` : null;
}

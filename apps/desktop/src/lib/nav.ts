import { RIOT_ID_RE } from "./riotId";
import { isFavourite } from "./recentFavs";
import { normalizeSearch, searchChampions, type Searchable } from "./searchMatch";
import { Home, Swords, Shield, BarChart3, User, Settings, type LucideIcon } from "lucide-react";
export interface NavItem { path: string; label: string; icon: LucideIcon }
/** Only screens that exist are listed. The live game is a tab of Draft (yours) and of Profile (anyone's); `/live` stays as the scout page. */
export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/draft", label: "Draft", icon: Swords },
  { path: "/champions", label: "Champions", icon: Shield },
  { path: "/tierlist", label: "Tier List", icon: BarChart3 },
  { path: "/profile", label: "Profile", icon: User },
];
export const SETTINGS_ITEM: NavItem = { path: "/settings", label: "Settings", icon: Settings };

/** Champion page route for a Data Dragon champion id. */
export const championPath = (id: string) => `/champions/${encodeURIComponent(id)}`;

export type PaletteGroup = "Pages" | "Champions" | "Players";
/** One selectable row of the Ctrl+K palette. `key` is unique across groups. */
export type PaletteEntry<T extends Searchable = Searchable> =
  | { kind: "page"; group: "Pages"; key: string; item: NavItem }
  | { kind: "champion"; group: "Champions"; key: string; champion: T; path: string }
  /** A player from favourites or recent searches (local data only). */
  | { kind: "player"; group: "Players"; key: string; riotId: string; path: string; favourite: boolean }
  /** "Look up name#tag": shown when the typed text is a full Riot ID that is not in the lists above. */
  | { kind: "lookup"; group: "Players"; key: string; riotId: string; path: string };

export const profilePath = (riotId: string) => `/profile/${encodeURIComponent(riotId)}`;

/** `stored`: Riot IDs the local backend already has (from `GET /v1/players`), listed after favourites and recents. */
export interface PaletteOptions { favourites?: readonly string[]; recent?: readonly string[]; stored?: readonly string[]; championLimit?: number; playerLimit?: number }

/**
 * Rows for the palette, in display order: Pages (so Enter on a page name still works), Champions, then Players.
 * - Empty query: every page, then favourites and recent searches; no champions (156+ rows would bury the pages).
 * - Text: matching pages, up to `championLimit` champions, and the favourites/recents whose Riot ID contains the text
 *   (same case/space/punctuation-insensitive rule everywhere: "tierlist" finds Tier List, "faker" finds Faker#KR1).
 * - A full Riot ID (Name#TAG): only the Players group, "Look up" first. No Riot call happens while typing; Riot has no name-prefix search.
 */
export function buildPaletteEntries<T extends Searchable>(query: string, champions: readonly T[] | undefined, opts: PaletteOptions = {}): PaletteEntry<T>[] {
  const { favourites = [], recent = [], stored = [], championLimit = 6, playerLimit = 8 } = opts;
  const q = normalizeSearch(query), typed = query.trim();

  // Favourites first, then recents, then players the backend stored; each Riot ID once (they compare case-insensitively).
  const known: string[] = [];
  for (const id of [...favourites, ...recent, ...stored]) if (!isFavourite(known, id)) known.push(id);
  const players: PaletteEntry<T>[] = known
    .filter((id) => !q || normalizeSearch(id).includes(q))
    .slice(0, playerLimit)
    .map((riotId) => ({ kind: "player", group: "Players", key: `player:${riotId.toLowerCase()}`, riotId, path: profilePath(riotId), favourite: isFavourite(favourites, riotId) }));

  if (RIOT_ID_RE.test(typed)) {
    const lookup: PaletteEntry<T>[] = isFavourite(known, typed) ? [] : [{ kind: "lookup", group: "Players", key: "lookup", riotId: typed, path: profilePath(typed) }];
    return [...lookup, ...players];
  }
  const pages: PaletteEntry<T>[] = [...NAV, SETTINGS_ITEM]
    .filter((n) => !q || normalizeSearch(n.label).includes(q))
    .map((item) => ({ kind: "page", group: "Pages", key: `page:${item.path}`, item }));
  const champs: PaletteEntry<T>[] = q && champions
    ? searchChampions(champions, query, championLimit).map((champion) => ({ kind: "champion", group: "Champions", key: `champ:${champion.id}`, champion, path: championPath(champion.id) }))
    : [];
  return [...pages, ...champs, ...players];
}

/**
 * Champ select just started (not active before, active now) and the setting is on: open the Draft page, unless you are already on it.
 * It fires only on that change, so leaving the page during the draft is respected. Connecting to a draft already under way counts as a start.
 */
export const shouldOpenDraft = (wasActive: boolean, active: boolean, enabled: boolean, path: string): boolean => enabled && active && !wasActive && !path.startsWith("/draft");

/**
 * You just locked in (not locked before, locked now) and the setting is on: the setup page for that champion, or null.
 * Only when you are on the Draft page itself: if you went to another screen the page never jumps in front of you, and being on the setup page already is a no-op.
 * Fires only on the change, so coming back to Draft afterwards does not bounce you out again. `id` is the Data Dragon id of your locked champion.
 */
export const setupPathOnLock = (wasLocked: boolean, locked: boolean, enabled: boolean, path: string, id: string | undefined, role: string | null): string | null =>
  enabled && locked && !wasLocked && id && path === "/draft" ? `/draft/setup/${encodeURIComponent(id)}${role ? `/${role}` : ""}` : null;

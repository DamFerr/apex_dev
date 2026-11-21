/** Small pure helpers of the Leaderboard page (paging and the starting region). */
export const PAGE_SIZE = 50;

/** Number of pages for `total` rows; always at least 1, so an empty list still shows "page 1". */
export const pageCount = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));

/** "51–100 of 300", or "0 players" for an empty list. `shown` = rows on this page. */
export const pageLabel = (offset: number, shown: number, total: number) => (total <= 0 || shown <= 0 ? "0 players" : `${offset + 1}–${offset + shown} of ${total.toLocaleString()}`);

/**
 * The region the page opens on: the player's own region if known, else the region picked in the stats filter (unless it is "all"), else Europe West.
 * `known` = the region ids the backend can serve; an id outside it is skipped.
 */
export function defaultRegion(mine: string | undefined, statsPlatform: string, known: readonly string[]): string {
  for (const id of [mine, statsPlatform]) if (id && known.includes(id)) return id;
  return "euw1";
}

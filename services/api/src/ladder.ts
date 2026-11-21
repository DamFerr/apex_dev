import type { LadderQueue, LadderRow, LadderTier } from "@apex/schema";
import { APEX_SEATS } from "./cutoffs";
import type { ApexLeague, ApexQueue } from "./riot";

export const LADDER_TIERS: readonly LadderTier[] = ["CHALLENGER", "GRANDMASTER", "MASTER"];
export const RIOT_QUEUE: Record<LadderQueue, ApexQueue> = { solo: "RANKED_SOLO_5x5", flex: "RANKED_FLEX_SR" };

/**
 * The Master+ ladder of one platform and queue as one list ranked by LP (L.1). Pure.
 * Tier: for Solo/Duo the seats decide (the last Challenger / Grandmaster seat, like `apexCutoffs`), because Riot's own lists are only re-cut once a day and
 * would put players in the wrong tier. Flex has no known seats, and so does Solo/Duo on a platform with unknown seats or too few players: then the list
 * a player is in decides. Players without a puuid (Riot's older list format) are left out, a row needs it to be looked up. Ties in LP keep Challenger, Grandmaster, Master order.
 */
export function buildLadder(platform: string, queue: LadderQueue, lists: { master: ApexLeague; grandmaster: ApexLeague; challenger: ApexLeague }): LadderRow[] {
  const pooled = ([["CHALLENGER", lists.challenger], ["GRANDMASTER", lists.grandmaster], ["MASTER", lists.master]] as const)
    .flatMap(([tier, l]) => l.entries.flatMap((e) => (e.puuid ? [{ tier: tier as LadderTier, e: e as typeof e & { puuid: string } }] : [])))
    .sort((a, b) => b.e.leaguePoints - a.e.leaguePoints);
  const seats = queue === "solo" ? APEX_SEATS[platform] : undefined, bySeats = !!seats && pooled.length >= seats.challenger + seats.grandmaster;
  return pooled.map(({ tier, e }, i) => ({
    rank: i + 1, puuid: e.puuid, lp: e.leaguePoints, wins: e.wins ?? 0, losses: e.losses ?? 0, hotStreak: !!e.hotStreak,
    tier: bySeats ? (i < seats!.challenger ? "CHALLENGER" : i < seats!.challenger + seats!.grandmaster ? "GRANDMASTER" : "MASTER") : tier,
  }));
}

/** `?tier=CHALLENGER,MASTER` to a list; anything unknown is ignored, nothing valid means all three tiers. */
export function parseTiers(q: string | undefined): LadderTier[] {
  const want = (q ?? "").toUpperCase().split(",").map((x) => x.trim());
  const out = LADDER_TIERS.filter((t) => want.includes(t));
  return out.length ? out : [...LADDER_TIERS];
}

/** One page of the rows whose tier is selected. Ranks stay the ones on the whole ladder. */
export function pageLadder(rows: readonly LadderRow[], tiers: readonly LadderTier[], offset: number, limit: number): { total: number; entries: LadderRow[] } {
  const hit = rows.filter((r) => tiers.includes(r.tier));
  return { total: hit.length, entries: hit.slice(offset, offset + limit) };
}

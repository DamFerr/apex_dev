import type { RankInfo } from "@apex/schema";
import { useCutoffs } from "./api";
import { apexRing, isApexTier, type ApexRing } from "./lpRing";

/** The LP ring of a rank (RC.3): reads today's Master+ cut-offs only for Master and above, and falls back to the full ring while they load or if they fail. */
export function useApexRing(rank: RankInfo | null | undefined, platform?: string): ApexRing | null {
  const cuts = useCutoffs(platform, !!rank && isApexTier(rank.tier));
  return rank ? apexRing(rank.tier, rank.lp, cuts.data) : null;
}

/** Hover text for the note under the LP line. */
export const CUTOFF_HINT = "Estimated from the Master+ ladder on your region now: the LP of the last Challenger seat and of the last Grandmaster seat (smaller regions: the lowest LP in Riot's list). Riot re-cuts the tiers once a day, so the real promotion can come later.";

import type { ApexCutoffs } from "@apex/schema";
import type { ApexLeague } from "./riot";

const lowest = (l: ApexLeague): number | null => (l.entries.length ? Math.min(...l.entries.map((e) => e.leaguePoints)) : null);

/**
 * Seats of the Solo/Duo ladder per platform (Riot support, "Master, Grandmaster and Challenger: The Apex Tiers"): the top `challenger` players are
 * Challenger, the next `grandmaster` players Grandmaster. TW and TH are from a third-party guide, ME is unknown (falls back to the list cut-off).
 */
const BIG = { grandmaster: 700, challenger: 300 }, MID = { grandmaster: 500, challenger: 200 }, SMALL = { grandmaster: 100, challenger: 50 };
export const APEX_SEATS: Record<string, { grandmaster: number; challenger: number }> = {
  na1: BIG, euw1: BIG, kr: BIG, vn2: BIG, ph2: BIG, sg2: BIG,
  eun1: MID, br1: MID, tr1: MID, la1: MID, la2: MID, tw2: MID,
  oc1: SMALL, ru: SMALL, jp1: SMALL, th2: SMALL,
};

/**
 * Master+ cut-offs (RC.1, RC.4). Pure; the player's own LP is not involved.
 * Riot's Grandmaster and Challenger lists are only re-cut once a day, while LP keeps moving, so their lowest entry sits below the real cut-off
 * (NA: list 1887 against about 1982 on a ranking site). So all three lists are pooled and ranked by LP: Challenger = LP of the last Challenger seat,
 * Grandmaster = LP of the last Grandmaster seat (Challenger seats + Grandmaster seats). Where the seats are unknown or not filled, the lowest LP of
 * Riot's own Challenger / Grandmaster list is used instead.
 */
export function apexCutoffs(platform: string, lists: { master: ApexLeague; grandmaster: ApexLeague; challenger: ApexLeague }, at: string): ApexCutoffs {
  const seats = APEX_SEATS[platform];
  const ranked = [...lists.master.entries, ...lists.grandmaster.entries, ...lists.challenger.entries].map((e) => e.leaguePoints).sort((a, b) => b - a);
  const atSeat = (n: number | undefined) => (n !== undefined && ranked.length >= n ? ranked[n - 1] : null);
  return {
    platform,
    grandmaster: atSeat(seats && seats.challenger + seats.grandmaster) ?? lowest(lists.grandmaster),
    challenger: atSeat(seats?.challenger) ?? lowest(lists.challenger),
    at,
  };
}

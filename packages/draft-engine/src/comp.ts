import type { Pick } from "./engine";

/** Fewer measured games than this and a champion's damage numbers are not trusted; the class-tag estimate is used instead. */
export const MIN_PROFILE_GAMES = 20;

/** Sums over the collected games of one champion (see `CompProfileRow` in @apex/schema). */
export interface CompProfile { games: number; phys: number; magic: number; trueDmg: number; taken: number; cc: number; seconds: number }

/** What one team brings. Shares add up to 1. `measured` = every pick came from collected games; otherwise the split is a class-tag estimate. */
export interface TeamComp {
  picks: number; measuredPicks: number; measured: boolean;
  ad: number; ap: number; trueShare: number;
  /** Per minute, summed over the team. null when not measured (never invented from class tags). */
  takenPerMin: number | null; ccPerMin: number | null;
}

/** The class-tag rule the engine always used: Mage and Support lean on ability power, everything else on attack damage. */
const leansAp = (tags: string[]) => tags[0] === "Mage" || tags[0] === "Support";

/**
 * Damage split, tankiness and CC of a team from its locked picks.
 * Measured: each champion's average damage per minute by type is summed, so a carry counts for more than a support.
 * The measured path needs EVERY pick to have `MIN_PROFILE_GAMES` games; mixing damage-per-minute with pick counts would be
 * meaningless, so otherwise the whole split is the tag estimate (the same rule as before this module existed).
 */
export function teamComp(picks: Pick[], profile: (champion: number) => CompProfile | null | undefined, tags: (champion: number) => string[]): TeamComp {
  const profiles = picks.map((p) => profile(p.champion)).map((p) => (p && p.games >= MIN_PROFILE_GAMES && p.seconds > 0 ? p : null));
  const measuredPicks = profiles.filter(Boolean).length, n = picks.length;
  if (n > 0 && measuredPicks === n) {
    let phys = 0, magic = 0, tru = 0, taken = 0, cc = 0;
    for (const p of profiles as CompProfile[]) { const m = 60 / p.seconds; phys += p.phys * m; magic += p.magic * m; tru += p.trueDmg * m; taken += p.taken * m; cc += p.cc * m; }
    const total = phys + magic + tru;
    if (total > 0) return { picks: n, measuredPicks, measured: true, ad: phys / total, ap: magic / total, trueShare: tru / total, takenPerMin: taken, ccPerMin: cc };
  }
  const ap = picks.filter((p) => leansAp(tags(p.champion))).length;
  return { picks: n, measuredPicks, measured: false, ad: n ? (n - ap) / n : 0, ap: n ? ap / n : 0, trueShare: 0, takenPerMin: null, ccPerMin: null };
}

/** The larger of the two main damage types, as a 0..1 share. 0 for an empty team. */
export const damageSkew = (c: TeamComp) => Math.max(c.ad, c.ap);

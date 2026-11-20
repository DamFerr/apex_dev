/** What the LP ring on Home and Profile shows. Pure. */
import type { ApexCutoffs } from "@apex/schema";

const APEX = ["MASTER", "GRANDMASTER", "CHALLENGER"];
export const isApexTier = (tier: string) => APEX.includes(tier.toUpperCase());

export interface LpRing {
  /** Ring fill, always 0..100. */
  value: number;
  /** Master and above: LP is not capped and has no promotion bar, so the ring is a full gold ring and not a progress claim. */
  apex: boolean;
  /** Screen reader text. */
  label: string;
}

/**
 * Below Master the ring is the LP out of 100 needed for the next division or tier (clamped, so a bad value can never over-draw the ring).
 * Master, Grandmaster and Challenger have no 100 LP target: LP runs into the thousands and the Grandmaster and Challenger cut-offs move daily.
 * Dividing that LP by 100 made the ring spin many times when it loaded, or sit almost full, so there it is a full ring with no progress claim.
 */
export function lpRing(tier: string, lp: number): LpRing {
  if (isApexTier(tier)) return { value: 100, apex: true, label: `${lp} LP. Master and above have no LP bar.` };
  const value = Math.min(100, Math.max(0, lp));
  return { value, apex: false, label: `${lp} of 100 LP to the next division` };
}

/** "Emerald II", but just "Challenger": Master and above have no divisions (Riot's API still sends "I"). */
export function rankTitle(tier: string, division: string): string {
  const name = tier[0] + tier.slice(1).toLowerCase();
  return isApexTier(tier) ? name : `${name} ${division}`;
}

export interface ApexRing extends LpRing {
  /** True when the ring makes no progress claim (full gold ring): Challenger, or Master+ without a cut-off to measure against. */
  full: boolean;
  /** One line for under the rank ("142 LP to Grandmaster"), null when there is nothing honest to say. */
  note: string | null;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * The ring for any tier (RC.2), given today's cut-offs (undefined while loading or when they failed: Master+ then falls back to `lpRing`'s full ring).
 * - Below Master: LP out of 100, as `lpRing`.
 * - Master: LP out of the Grandmaster cut-off (Master starts at 0 LP).
 * - Grandmaster: from the Grandmaster cut-off up to the Challenger cut-off.
 * - Challenger: a full ring; the note says how far above the cut-off. There is no tier above it.
 * Riot refreshes the tier lists on its own schedule, so LP above the next cut-off is possible and reads "above the cut-off", with the ring full.
 */
export function apexRing(tier: string, lp: number, cuts: Pick<ApexCutoffs, "grandmaster" | "challenger"> | undefined): ApexRing {
  const base = lpRing(tier, lp), t = tier.toUpperCase();
  if (!base.apex) return { ...base, full: false, note: null };
  const full = (note: string | null = null): ApexRing => ({ ...base, full: true, note });
  const gm = cuts?.grandmaster ?? null, ch = cuts?.challenger ?? null;
  if (t === "CHALLENGER") {
    if (ch === null) return full();
    return full(lp >= ch ? `${lp - ch} LP above the cut-off (${ch})` : `${ch - lp} LP below the cut-off (${ch})`);
  }
  const [floor, target, next] = t === "MASTER" ? [0, gm, "Grandmaster"] as const : [gm, ch, "Challenger"] as const;
  if (target === null || floor === null || target <= floor) return full();
  const left = target - lp;
  return {
    value: clamp(((lp - floor) / (target - floor)) * 100), apex: true, full: false,
    label: left > 0 ? `${lp} LP, ${left} to the ${next} cut-off of ${target}` : `${lp} LP, above the ${next} cut-off of ${target}`,
    note: left > 0 ? `${left} LP to ${next}` : `Above the ${next} cut-off (${target})`,
  };
}

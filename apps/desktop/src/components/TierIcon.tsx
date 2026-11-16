import type { RankInfo, Tier } from "@apex/schema";

/**
 * Our own rank emblems. Riot's rank emblems are not part of Data Dragon and are not used here, so these are original drawings:
 * a shield whose color is the tier's, with one pip per division step (IV = 1 pip ... I = 4 pips; none for Master and above).
 * The tier is also always written next to the emblem, so color is never the only signal.
 */
export const TIER_COLOR: Record<Tier, string> = {
  IRON: "#7b7f8a", BRONZE: "#b0773e", SILVER: "#aab4c3", GOLD: "#e2b23c", PLATINUM: "#3fb5b0", EMERALD: "#2fbf71",
  DIAMOND: "#5b8cff", MASTER: "#b25cff", GRANDMASTER: "#ef5a64", CHALLENGER: "#4fd8ff",
};
const PIPS: Record<string, number> = { IV: 1, III: 2, II: 3, I: 4 };
const TOP: Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

export function TierIcon({ tier, division, size = 40, decorative = true }: { tier: Tier | string; division?: RankInfo["division"] | string; size?: number; decorative?: boolean }) {
  const key = (tier in TIER_COLOR ? tier : null) as Tier | null, color = key ? TIER_COLOR[key] : "#6b7280", top = !!key && TOP.includes(key);
  const pips = key && !top ? PIPS[division ?? ""] ?? 0 : 0, label = key ? `${key[0] + key.slice(1).toLowerCase()}${division && !top ? ` ${division}` : ""}` : "Unranked";
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className="shrink-0" data-tier={key ?? "UNRANKED"} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      {!decorative && <title>{label}</title>}
      <path d="M16 2 L28 7 V16 C28 22 23 26.5 16 29 C9 26.5 4 22 4 16 V7 Z" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M16 7 L23 10 V16 C23 19.5 20 22.5 16 24 C12 22.5 9 19.5 9 16 V10 Z" fill={color} fillOpacity={key ? 0.85 : 0.3} />
      {top && <path d="M12 17 L16 12 L20 17" fill="none" stroke="#0b0f1a" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
      {pips > 0 && Array.from({ length: pips }, (_, i) => <circle key={i} cx={16 + (i - (pips - 1) / 2) * 4} cy={16} r={1.5} fill="#0b0f1a" />)}
    </svg>
  );
}

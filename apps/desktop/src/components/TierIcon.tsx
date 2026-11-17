import { useId } from "react";
import type { RankInfo, Tier } from "@apex/schema";

/**
 * Our own rank emblems, original drawings. Riot's rank emblems are NOT used: they are not part of Data Dragon, and Riot's developer
 * policy limits Riot assets to Data Dragon, the Press Kit and game static data and asks products not to resemble Riot's own in style
 * (see docs/COMPLIANCE.md row 6). The design is a faceted gem on a beveled shield:
 *  - the metal of the shield and the gem use the tier's color (light to dark gradient),
 *  - the crown grows with the tier: none up to Silver, then 1, 1, 2, 2, 3, 3 and 5 points for Challenger,
 *  - four pips under the shield show the division (IV = 1 filled ... I = 4 filled); Master and above have no division.
 * The tier is also always written next to the emblem, so color is never the only signal.
 */
export const TIER_COLOR: Record<Tier, string> = {
  IRON: "#7b7f8a", BRONZE: "#b0773e", SILVER: "#aab4c3", GOLD: "#e2b23c", PLATINUM: "#3fb5b0", EMERALD: "#2fbf71",
  DIAMOND: "#5b8cff", MASTER: "#b25cff", GRANDMASTER: "#ef5a64", CHALLENGER: "#4fd8ff",
};
/** Points on the crown above the shield. */
export const CROWN_POINTS: Record<Tier, number> = { IRON: 0, BRONZE: 0, SILVER: 0, GOLD: 1, PLATINUM: 1, EMERALD: 2, DIAMOND: 2, MASTER: 3, GRANDMASTER: 3, CHALLENGER: 5 };
const PIPS: Record<string, number> = { IV: 1, III: 2, II: 3, I: 4 };
const TOP: Tier[] = ["MASTER", "GRANDMASTER", "CHALLENGER"];

/** x centres of the crown points (the middle one is taller). */
const crownXs = (n: number) => n === 1 ? [16] : n === 2 ? [11, 21] : n === 3 ? [10.5, 16, 21.5] : n === 5 ? [8.5, 12.25, 16, 19.75, 23.5] : [];

export function TierIcon({ tier, division, size = 40, decorative = true }: { tier: Tier | string; division?: RankInfo["division"] | string; size?: number; decorative?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, ""), metal = `m${uid}`, gem = `g${uid}`;
  const key = (tier in TIER_COLOR ? tier : null) as Tier | null, color = key ? TIER_COLOR[key] : "#6b7280", top = !!key && TOP.includes(key);
  const pips = key && !top ? PIPS[division ?? ""] ?? 0 : 0, showPips = !!key && !top && pips > 0;
  const label = key ? `${key[0] + key.slice(1).toLowerCase()}${division && !top ? ` ${division}` : ""}` : "Unranked";
  const xs = key ? crownXs(CROWN_POINTS[key]) : [], dim = key ? 1 : 0.55;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className="shrink-0" data-tier={key ?? "UNRANKED"} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      {!decorative && <title>{label}</title>}
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.75" /><stop offset="0.25" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0.45" /></linearGradient>
        <linearGradient id={gem} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.9" /><stop offset="0.45" stopColor={color} /><stop offset="1" stopColor={color} stopOpacity="0.7" /></linearGradient>
      </defs>
      <g opacity={dim}>
        {/* crown points (drawn first so the shield overlaps their feet) */}
        {xs.map((x, i) => { const tall = xs.length > 1 && i === Math.floor(xs.length / 2), h = tall ? 4.2 : xs.length === 1 ? 3.6 : 3;
          return <path key={x} d={`M${x - 1.7} 4.6 L${x} ${4.6 - h} L${x + 1.7} 4.6 Z`} fill={`url(#${metal})`} stroke={color} strokeWidth={0.6} strokeLinejoin="round" />; })}
        {/* shield: outer bevel, then a recessed inner field */}
        <path d="M16 3.6 L26 7.4 V15 C26 20.4 21.6 24.4 16 26.4 C10.4 24.4 6 20.4 6 15 V7.4 Z" fill={`url(#${metal})`} stroke={color} strokeWidth={0.9} strokeLinejoin="round" />
        <path d="M16 6.2 L23.2 9 V15 C23.2 18.9 20.1 21.9 16 23.5 C11.9 21.9 8.8 18.9 8.8 15 V9 Z" fill="#0b0f1a" fillOpacity={0.62} stroke="#000" strokeOpacity={0.35} strokeWidth={0.5} strokeLinejoin="round" />
        {/* faceted gem */}
        <path d="M16 9.6 L20.6 14 L16 20 L11.4 14 Z" fill={`url(#${gem})`} stroke={color} strokeWidth={0.5} strokeLinejoin="round" />
        <path d="M16 9.6 L11.4 14 L16 14 Z" fill="#fff" fillOpacity={0.35} />
        <path d="M11.4 14 L20.6 14 L16 20 Z" fill="#000" fillOpacity={0.18} />
        <path d="M16 14 L16 20" stroke="#fff" strokeOpacity={0.3} strokeWidth={0.4} />
        {top && <circle cx={16} cy={14.8} r={7.6} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={0.6} />}
      </g>
      {/* division pips: four slots, filled for the division (only for tiers that have divisions) */}
      {showPips && Array.from({ length: 4 }, (_, i) => <circle key={i} cx={16 + (i - 1.5) * 4} cy={29.4} r={1.25} fill={color} fillOpacity={i < pips ? 1 : 0.22} />)}
    </svg>
  );
}

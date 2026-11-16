import type { Role } from "@apex/schema";

/**
 * Our own role glyphs. Role icons are not part of Data Dragon, so these are original simple drawings (no Riot artwork): a tiny map with the
 * lane or area of the role highlighted. Pass `decorative` when the role name is already written next to the icon.
 */
export const ROLE_LABEL: Record<Role, string> = { TOP: "Top", JUNGLE: "Jungle", MID: "Mid", ADC: "ADC", SUPPORT: "Support" };
const DIM = 0.28;

export function RoleIcon({ role, size = 18, decorative, className = "" }: { role: Role | string | null | undefined; size?: number; decorative?: boolean; className?: string }) {
  const known = (role && role in ROLE_LABEL ? role : null) as Role | null, label = known ? ROLE_LABEL[known] : "Unknown role";
  const lane = (d: string, on: boolean) => <path d={d} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={on ? 1 : DIM} />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`shrink-0 ${known ? "" : "text-muted"} ${className}`} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      {!decorative && <title>{label}</title>}
      {lane("M4 20V4H20", known === "TOP")}
      {lane("M4 20L20 4", known === "MID")}
      {lane("M4 20H20V4", known === "ADC" || known === "SUPPORT")}
      {known === "JUNGLE" && <><circle cx="9" cy="9" r="2.6" fill="currentColor" /><circle cx="15" cy="15" r="2.6" fill="currentColor" /></>}
      {known === "ADC" && <circle cx="17" cy="17" r="2.2" fill="currentColor" />}
      {known === "SUPPORT" && <path d="M16 13.2v5.6M13.2 16h5.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />}
      {!known && <circle cx="12" cy="12" r="1.6" fill="currentColor" opacity={0.6} />}
    </svg>
  );
}

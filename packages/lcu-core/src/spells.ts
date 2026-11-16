import type { Role } from "@apex/schema";

/** Summoner spell ids used by the League client. */
export const SPELLS = { Cleanse: 1, Exhaust: 3, Flash: 4, Ghost: 6, Heal: 7, Smite: 11, Teleport: 12, Ignite: 14, Barrier: 21 } as const;
export const SPELL_NAMES: Record<number, string> = Object.fromEntries(Object.entries(SPELLS).map(([n, id]) => [id, n]));

/**
 * Default recommendation by role, with Flash on the second slot (the usual F key).
 * Composition-aware choices will replace this later; the write path stays the same.
 */
export function recommendSpells(role: Role | null): [number, number] {
  const other = { TOP: SPELLS.Teleport, JUNGLE: SPELLS.Smite, MID: SPELLS.Ignite, ADC: SPELLS.Heal, SUPPORT: SPELLS.Ignite }[role ?? "MID"];
  return [other, SPELLS.Flash];
}

/** Which key your Flash is bound to: "D" is the left (first) summoner spell slot, "F" the right (second) one. */
export type FlashSlot = "D" | "F";

/**
 * Puts Flash on the slot you use. Apex's pairs always come with Flash second (F), so "F" returns the pair unchanged and "D" swaps it.
 * Pairs without Flash are never reordered, so a Smite + Teleport pair keeps whatever order it came in.
 */
export function placeFlash(pair: [number, number], slot: FlashSlot): [number, number] {
  const [a, b] = pair;
  if (a !== SPELLS.Flash && b !== SPELLS.Flash) return [a, b];
  const other = a === SPELLS.Flash ? b : a;
  return slot === "D" ? [SPELLS.Flash, other] : [other, SPELLS.Flash];
}

/** One summoner spell from Data Dragon's summoner.json: the client's numeric id, display name and icon file (img/spell/<image>). */
export interface SpellIcon { id: number; name: string; image: string }
/** summoner.json -> numeric spell id (the `key` field) to name and icon file. Entries that are malformed are skipped. Pure, so it is unit tested. */
export function parseSummonerSpells(json: unknown): Map<number, SpellIcon> {
  const out = new Map<number, SpellIcon>();
  const data = (json as { data?: Record<string, { key?: string; name?: string; image?: { full?: string } }> } | null)?.data ?? {};
  for (const s of Object.values(data)) {
    const id = Number(s?.key); if (!Number.isInteger(id) || !s.name || !s.image?.full) continue;
    out.set(id, { id, name: s.name, image: s.image.full });
  }
  return out;
}

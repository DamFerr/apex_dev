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

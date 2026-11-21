import type { Role } from "@apex/schema";
import type { DraftState } from "@apex/lcu-core";

/** Your allies' assigned roles from champ select, by champion key (the League client's number). Kept after champ select ends so the live game can use them. */
export type AllyRoles = Readonly<Record<number, Role>>;

/**
 * Updates the remembered roles from a draft state. A new champ select starts empty (so an old game's roles never leak in); then every locked ally
 * with an assigned role is added, and a later trade simply overwrites the champion's entry. When champ select is over the memory is left as it is.
 * Only your own team is ever here: the client does not tell you the enemy team's roles.
 */
export function nextAllyRoles(prev: AllyRoles, wasActive: boolean, next: DraftState): AllyRoles {
  if (!next.active) return prev;
  const out: Record<number, Role> = wasActive ? { ...prev } : {};
  for (const s of next.slots) if (s.team === "ally" && s.locked && s.role && s.championId > 0) out[s.championId] = s.role;
  return out;
}

/**
 * The exact roles of a live team, or null. Used only when all five champions are remembered with five different roles, which in practice means
 * your own team in a Summoner's Rift game you queued for through the client; anything less falls back to the estimate. `idOf` turns a champion key into its id.
 */
export function exactTeamRoles(team: readonly { champion: string }[], remembered: AllyRoles, idOf: (key: number) => string | undefined): Role[] | null {
  if (team.length !== 5) return null;
  const byId = new Map<string, Role>();
  for (const [key, role] of Object.entries(remembered)) { const id = idOf(Number(key)); if (id) byId.set(id.toLowerCase(), role); }
  const roles = team.map((p) => byId.get(p.champion.toLowerCase()));
  if (roles.some((r) => !r) || new Set(roles).size !== 5) return null;
  return roles as Role[];
}

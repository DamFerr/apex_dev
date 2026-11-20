import type { Role } from "@apex/schema";

const ALL: readonly Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

export interface RoleCandidate {
  /** The champion's roles, most played first (from the collected games). Empty = unknown. */
  roles: readonly Role[];
  /** Carries Smite (the only role signal the spectator data has). */
  smite: boolean;
}

/**
 * ESTIMATED roles of one team of five (Summoner's Rift). The spectator data has no role field, so the roles are the best fit of
 * "which champion is played where" over all 120 ways to hand out the five roles: a champion's most played role costs 0, its next 1, and so on;
 * a role it was never seen in costs 5. Smite decides the jungle (a Smite carrier outside the jungle, or a jungler without Smite, costs a lot).
 * Returns one role per candidate, or null for every player when the team is not exactly five (ARAM, custom games).
 */
export function assignRoles(team: readonly RoleCandidate[]): (Role | null)[] {
  if (team.length !== ALL.length) return team.map(() => null);
  const anySmite = team.some((p) => p.smite);
  const cost = (p: RoleCandidate, r: Role) => {
    const i = p.roles.indexOf(r);
    let c = i < 0 ? ALL.length : i;
    if (anySmite && (p.smite !== (r === "JUNGLE"))) c += 20;
    return c;
  };
  let best: Role[] = [...ALL], bestCost = Infinity;
  const used = new Array<boolean>(ALL.length).fill(false), cur: Role[] = [];
  const walk = (i: number, sum: number) => {
    if (sum >= bestCost) return;
    if (i === team.length) { bestCost = sum; best = [...cur]; return; }
    for (let k = 0; k < ALL.length; k++) {
      if (used[k]) continue;
      used[k] = true; cur[i] = ALL[k];
      walk(i + 1, sum + cost(team[i], ALL[k]));
      used[k] = false;
    }
  };
  walk(0, 0);
  return best;
}

/**
 * Puts a team in the usual order: top, jungle, mid, bot (ADC), support. Players without an estimated role (ARAM, custom games, a team that is not five)
 * keep the order they came in, after any with a role. Stable, and returns a new array.
 */
export function sortByRole<T>(players: readonly T[], roleOf: (p: T) => Role | null): T[] {
  const rank = (p: T) => { const r = roleOf(p); return r ? ALL.indexOf(r) : ALL.length; };
  return players.map((p, i) => ({ p, i, k: rank(p) })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.p);
}

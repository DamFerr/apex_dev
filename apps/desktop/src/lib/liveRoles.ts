import type { Role } from "@apex/schema";

const ALL: readonly Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

export interface RoleCandidate {
  /** The champion's roles, most played first (from the collected games). Empty = unknown. */
  roles: readonly Role[];
  /** Carries Smite (the strongest role signal the spectator data has). */
  smite: boolean;
  /** The player's summoner spell ids (optional): a weak hint, see SPELL_HINT. Missing = no hint. */
  spells?: readonly number[];
  /** Roles the player really played in their last games (optional). Needs HISTORY_MIN games to count; see HISTORY_WEIGHT. */
  history?: { games: number; roles: Partial<Record<Role, number>> };
}

/** Fewest recent games before the player's own history is trusted. */
export const HISTORY_MIN = 2;
/** Games at which the history counts fully; with fewer it counts proportionally (3 games = 3/5). Some of the last games are ARAM etc. and carry no position. */
const HISTORY_FULL = 5;
/** Cost bonus for a role the player played in ALL recent games (scaled by the share). Larger than the champion term (0 to 5), so a player's own habit beats the champion's pooled role, but smaller than Smite (20). */
const HISTORY_WEIGHT = 6;

/**
 * Cost change per role for a summoner spell (negative = the spell fits that role). Deliberately small next to the champion term:
 * it breaks ties and lets an off-meta pick (Yasuo with Exhaust, Yone with Heal) win over the champion's usual role, nothing more.
 * Ids: Exhaust 3, Heal 7, Teleport 12, Ignite 14, Cleanse 1. Smite (11) is handled separately.
 */
const SPELL_HINT: Readonly<Record<number, Partial<Record<Role, number>>>> = {
  3: { SUPPORT: -2, TOP: 1, JUNGLE: 1, MID: 0.5 },
  7: { ADC: -2, SUPPORT: -1, TOP: 1, JUNGLE: 1, MID: 1 },
  12: { TOP: -2, MID: -1, ADC: 2, SUPPORT: 2 },
  14: { SUPPORT: -1, ADC: 1 },
  1: { ADC: -1, MID: -0.5 },
};

/**
 * ESTIMATED roles of one team of five (Summoner's Rift). The spectator data has no role field, so the roles are the best fit of
 * "which champion is played where" over all 120 ways to hand out the five roles: a champion's most played role costs 0, its next 1, and so on;
 * a role it was never seen in costs 5. Smite decides the jungle (a Smite carrier outside the jungle, or a jungler without Smite, costs a lot).
 * Exhaust, Heal and Teleport nudge the other roles (SPELL_HINT).
 * Returns one role per candidate, or null for every player when the team is not exactly five (ARAM, custom games).
 */
export function assignRoles(team: readonly RoleCandidate[]): (Role | null)[] {
  if (team.length !== ALL.length) return team.map(() => null);
  const anySmite = team.some((p) => p.smite);
  const cost = (p: RoleCandidate, r: Role) => {
    const i = p.roles.indexOf(r);
    let c = i < 0 ? ALL.length : i;
    if (anySmite && (p.smite !== (r === "JUNGLE"))) c += 20;
    if (p.history && p.history.games >= HISTORY_MIN) c -= (HISTORY_WEIGHT * (p.history.roles[r] ?? 0)) / Math.max(p.history.games, HISTORY_FULL);
    for (const sp of p.spells ?? []) c += SPELL_HINT[sp]?.[r] ?? 0;
    return c;
  };
  let best: Role[] = [...ALL], bestCost = Infinity;
  const used = new Array<boolean>(ALL.length).fill(false), cur: Role[] = [];
  const walk = (i: number, sum: number) => {
    // No pruning on the running sum: spell hints make costs negative, and there are only 120 assignments.
    if (i === team.length) { if (sum < bestCost) { bestCost = sum; best = [...cur]; } return; }
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

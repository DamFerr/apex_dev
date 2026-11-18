import { shrink } from "@apex/stats-core";
import type { Role } from "@apex/schema";
import type { DraftData } from "./engine";
import { MASTERY_HALF_POINTS, MASTERY_MAX_Z, MASTERY_WEIGHT, PERSONAL_PRIOR, RECENT_HALF_GAMES, RECENT_WEIGHT, logit, toPP } from "./model";

/**
 * Layer D: how much your own record on a champion moves its log-odds. Your win rate is shrunk toward the
 * population rate, so 3 games barely matter and 100 games matter a lot.
 */
export function personalZ(population: number, wins: number, games: number, strength = PERSONAL_PRIOR): number {
  if (games <= 0) return 0;
  return logit(shrink(wins, games, population, strength)) - logit(population);
}

/** One champion of your pool: mastery points and your recent games on it per role (only games whose role is known; empty = unknown). */
export interface PoolChampion { champion: number; points: number; byRole: Partial<Record<Role, { games: number; wins: number }>> }
/** A pool champion as it counts for ONE role: recent games and wins in that role only, mastery as is. */
export interface RolePoolEntry { champion: number; points: number; games: number; wins: number }

/**
 * Your pool for one role. A champion you play only in another role is left out (your top-lane Irelia says nothing about a jungle game).
 * Without role information for its recent games (mastery only, or games with an unknown role) the champion counts when its collected games
 * show it in `role`.
 */
export function poolForRole(pool: PoolChampion[], role: Role, rolesOf: (champion: number) => Role[]): RolePoolEntry[] {
  return pool.flatMap((p) => {
    const mine = p.byRole[role], knownRoles = Object.keys(p.byRole).length > 0;
    if (knownRoles ? !mine : !rolesOf(p.champion).includes(role)) return [];
    return [{ champion: p.champion, points: p.points, games: mine?.games ?? 0, wins: mine?.wins ?? 0 }];
  });
}

/** 0..1 comfort with a champion: mastery (weight 0.75) and recent games in the role (weight 0.25), each saturating. Used to weigh your pool in ban suggestions. */
export const familiarity = (points: number, games: number) =>
  MASTERY_WEIGHT * (Math.max(0, points) / (Math.max(0, points) + MASTERY_HALF_POINTS)) + RECENT_WEIGHT * (Math.max(0, games) / (Math.max(0, games) + RECENT_HALF_GAMES));

/** Short text for the suggestion list: "312k mastery · 58% in 6 games" (parts without data are left out; empty when there is none). */
export function poolNote(e: RolePoolEntry): string {
  const parts: string[] = [];
  if (e.points > 0) parts.push(`${e.points >= 1000 ? `${Math.round(e.points / 1000)}k` : e.points} mastery`);
  if (e.games > 0) parts.push(`${Math.round((100 * e.wins) / e.games)}% in ${e.games} ${e.games === 1 ? "game" : "games"}`);
  return parts.join(" · ");
}

/**
 * Layer D for pick suggestions: log-odds bonus for a champion in your pool. Mostly mastery (a comfort estimate, capped at `MASTERY_MAX_Z`),
 * plus a smaller share of your shrunk record in the role (`personalZ`). Both parts are 0 without data.
 */
export function poolZ(population: number, e: RolePoolEntry): number {
  const mastery = Math.max(0, e.points) / (Math.max(0, e.points) + MASTERY_HALF_POINTS);
  return MASTERY_WEIGHT * MASTERY_MAX_Z * mastery + RECENT_WEIGHT * personalZ(population, e.wins, e.games);
}

export interface BanSuggestion { champion: number; score: number; pp: number; against?: number }
/**
 * Who to ban for `role`: champions that are strong in general and, above all, that beat the champions you
 * actually play (weighted by `weight`, e.g. `familiarity`, else by games). Synthetic data for now, same interface for real data later.
 */
export function recommendBans(role: Role, candidates: number[], data: DraftData, pool: { champion: number; games: number; weight?: number }[],
  opts: { exclude?: Set<number>; limit?: number } = {}): BanSuggestion[] {
  const weightOf = (p: { games: number; weight?: number }) => p.weight ?? p.games, total = pool.reduce((s, p) => s + weightOf(p), 0), out: BanSuggestion[] = [];
  for (const c of candidates) {
    if (opts.exclude?.has(c) || !data.roles(c).includes(role)) continue;
    let z = logit(data.strength(c, role)), best = 0, against: number | undefined;
    for (const p of pool) {
      const contribution = 2 * (weightOf(p) / total) * data.matchup(c, p.champion, role);
      z += contribution;
      if (contribution > best) { best = contribution; against = p.champion; }
    }
    out.push({ champion: c, score: z, pp: toPP(z), against });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5);
}

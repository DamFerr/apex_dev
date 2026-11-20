import type { DraftStats, Role } from "@apex/schema";
import type { DraftData } from "./engine";
import { shrink } from "@apex/stats-core";
import { SCALING_MIN_GAMES, SCALING_PRIOR, STRENGTH_PRIOR, logit, shrunkEdge, shrunkStrength } from "./model";
import { MIN_PROFILE_GAMES, profileBaseline, type CompProfile } from "./comp";

export type { DraftStats };
/** Guesses roles from Riot's class tags, only for champions the collector has not seen yet. */
export const guessRoles = (tags: string[]): Role[] =>
  ({ Marksman: ["ADC"], Support: ["SUPPORT"], Tank: ["TOP", "SUPPORT"], Fighter: ["TOP", "JUNGLE"], Assassin: ["MID", "JUNGLE"], Mage: ["MID"] } as Record<string, Role[]>)[tags[0]] ?? ["MID"];

const addProfiles = (a: CompProfile, b: CompProfile): CompProfile => ({ games: a.games + b.games, phys: a.phys + b.phys, magic: a.magic + b.magic, trueDmg: a.trueDmg + b.trueDmg, taken: a.taken + b.taken, cc: a.cc + b.cc, seconds: a.seconds + b.seconds });

/**
 * Builds engine data from collected games. Pair effects are measured against the win rate the two champions' own
 * strengths already predict, so the engine's strength term and these edges never count the same thing twice.
 * Everything is shrunk toward its expectation, so a pairing seen 3 times barely moves the result.
 */
/**
 * What `createRealData` returns: the engine's `DraftData` plus the measured scaling of a champion in a role (E.2c; `scalingTerms` in engine.ts feeds it into the win probability, E.2d).
 * `score` = shrunk win rate in late games (over 33 min) minus shrunk win rate in early games (under 25 min), as a fraction (+0.04 = 4 points better late).
 * `games` = early plus late games behind it. null = fewer than `SCALING_MIN_GAMES` in either bucket, or no role.
 * It is a correlation (long games are also won by stronger teams), and the UI has to say so.
 */
export type RealDraftData = DraftData & { scaling(champion: number, role?: Role | null): { score: number; games: number } | null };

export function createRealData(stats: DraftStats, keyOf: ReadonlyMap<string, number>, tagsOf: (key: number) => string[]): RealDraftData {
  // Profiles per champion AND role (rows without a role count as "all roles"), plus the champion's total over its roles as the fallback.
  const byRole = new Map<string, CompProfile>(), total = new Map<string, CompProfile>();
  for (const r of stats.profiles ?? []) {
    const { id, role, ...sums } = r as CompProfile & { id: string; role?: string | null };
    if (role) byRole.set(`${id}|${role}`, sums);
    const t = total.get(id); total.set(id, t ? addProfiles(t, sums) : { ...sums });
  }
  const baseline = profileBaseline([...total.values()]);
  const idOf = new Map([...keyOf].map(([id, key]) => [key, id])), champ = new Map(stats.champions.map((c) => [c.id, c]));
  const strength = (id: string) => { const c = champ.get(id); return c ? shrunkStrength(c.wins, c.games) : 0.5; };
  // Role-keyed numbers (newer backends). A role's record is shrunk toward the champion's OVERALL rate, not 50%: few games in a role say little
  // about the role, but the champion's general strength still holds. No games in the role = the overall rate.
  const inRole = new Map((stats.roleChampions ?? []).map((c) => [`${c.id}|${c.role}`, c] as const));
  const roleStrength = (id: string, role?: string | null) => { const c = role ? inRole.get(`${id}|${role}`) : undefined; return c ? shrink(c.wins, c.games, strength(id), STRENGTH_PRIOR) : strength(id); };
  const buckets = new Map<string, { games: number; wins: number }>(); // "id|role|bucket"
  for (const [id, role, bucket, games, wins] of stats.lengthBuckets ?? []) buckets.set(`${id}|${role}|${bucket}`, { games, wins });
  const edges = (pairs: DraftStats["matchups"], expected: (x: string, y: string) => number) =>
    new Map(pairs.map(([x, y, games, wins]) => [`${x}|${y}`, shrunkEdge(wins, games, expected(x, y))] as const));
  const lane = edges(stats.matchups, (x, y) => logit(strength(x)) - logit(strength(y)));      // x against y, all roles (old data / no role known)
  const laneRole = new Map((stats.roleMatchups ?? []).map(([x, y, role, games, wins]) =>
    [`${x}|${y}|${role}`, shrunkEdge(wins, games, logit(roleStrength(x, role)) - logit(roleStrength(y, role)))] as const));
  const team = edges(stats.synergies, (x, y) => logit(strength(x)) + logit(strength(y)));      // x with y
  return {
    strength: (c, role) => { const id = idOf.get(c); return id ? roleStrength(id, role) : 0.5; },
    tags: tagsOf,
    scaling: (c, role) => {
      const id = idOf.get(c); if (!id || !role) return null;
      const early = buckets.get(`${id}|${role}|0`), late = buckets.get(`${id}|${role}|2`);
      if (!early || !late || early.games < SCALING_MIN_GAMES || late.games < SCALING_MIN_GAMES) return null;
      const prior = roleStrength(id, role); // each bucket is pulled toward the champion's own (shrunk) rate in this role
      return { score: shrink(late.wins, late.games, prior, SCALING_PRIOR) - shrink(early.wins, early.games, prior, SCALING_PRIOR), games: early.games + late.games };
    },
    games: (c, role) => { const id = idOf.get(c); if (!id) return 0; const r = role ? inRole.get(`${id}|${role}`) : undefined; return r ? r.games : champ.get(id)?.games ?? 0; },
    // The role's own numbers when it has enough games, else the champion's total over all its roles.
    profile: (c, role) => { const id = idOf.get(c) ?? ""; const r = role ? byRole.get(`${id}|${role}`) : undefined; return r && r.games >= MIN_PROFILE_GAMES ? r : total.get(id) ?? null; },
    baseline: () => baseline,
    roles: (c) => { const known = champ.get(idOf.get(c) ?? "")?.roles ?? []; return known.length ? (known as Role[]) : guessRoles(tagsOf(c)); },
    // Pairs are stored once with the first id alphabetically first; the reverse direction is the negative (matchup) or the same (synergy).
    // With a role and a backend that sends role-keyed pairs, ONLY that role's games count (a pair never seen in the role = 0, no leak from other roles);
    // without a role, or on old data without roleMatchups, the role-less pairs are used.
    matchup: (a, b, role) => {
      const x = idOf.get(a), y = idOf.get(b); if (!x || !y) return 0;
      const edge = (p: string, q: string) => (role && stats.roleMatchups ? laneRole.get(`${p}|${q}|${role}`) : lane.get(`${p}|${q}`)) ?? 0;
      return x < y ? edge(x, y) : -edge(y, x);
    },
    synergy: (a, b) => { const x = idOf.get(a), y = idOf.get(b); if (!x || !y) return 0; return team.get(x < y ? `${x}|${y}` : `${y}|${x}`) ?? 0; },
  };
}

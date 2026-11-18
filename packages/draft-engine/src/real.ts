import type { DraftStats, Role } from "@apex/schema";
import type { DraftData } from "./engine";
import { logit, shrunkEdge, shrunkStrength } from "./model";
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
export function createRealData(stats: DraftStats, keyOf: ReadonlyMap<string, number>, tagsOf: (key: number) => string[]): DraftData {
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
  const edges = (pairs: DraftStats["matchups"], expected: (x: string, y: string) => number) =>
    new Map(pairs.map(([x, y, games, wins]) => [`${x}|${y}`, shrunkEdge(wins, games, expected(x, y))] as const));
  const lane = edges(stats.matchups, (x, y) => logit(strength(x)) - logit(strength(y)));      // x against y
  const team = edges(stats.synergies, (x, y) => logit(strength(x)) + logit(strength(y)));      // x with y
  return {
    strength: (c) => { const id = idOf.get(c); return id ? strength(id) : 0.5; },
    tags: tagsOf,
    // The role's own numbers when it has enough games, else the champion's total over all its roles.
    profile: (c, role) => { const id = idOf.get(c) ?? ""; const r = role ? byRole.get(`${id}|${role}`) : undefined; return r && r.games >= MIN_PROFILE_GAMES ? r : total.get(id) ?? null; },
    baseline: () => baseline,
    roles: (c) => { const known = champ.get(idOf.get(c) ?? "")?.roles ?? []; return known.length ? (known as Role[]) : guessRoles(tagsOf(c)); },
    // Pairs are stored once with the first id alphabetically first; the reverse direction is the negative (matchup) or the same (synergy).
    matchup: (a, b) => { const x = idOf.get(a), y = idOf.get(b); if (!x || !y) return 0; return x < y ? lane.get(`${x}|${y}`) ?? 0 : -(lane.get(`${y}|${x}`) ?? 0); },
    synergy: (a, b) => { const x = idOf.get(a), y = idOf.get(b); if (!x || !y) return 0; return team.get(x < y ? `${x}|${y}` : `${y}|${x}`) ?? 0; },
  };
}

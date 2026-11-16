import { shrink } from "@apex/stats-core";
import type { DraftStats, Role } from "@apex/schema";
import { logit, sigmoid, type DraftData } from "./engine";
import { guessRoles } from "./roles";

export type { DraftStats };
const STRENGTH_PRIOR = 50; // virtual games pulling a champion's win rate toward 50%
const PAIR_PRIOR = 30;     // virtual games pulling a pairing toward what the two strengths predict

/**
 * Builds engine data from collected games. Pair effects are measured against the win rate the two champions' own
 * strengths already predict, so the engine's strength term and these edges never count the same thing twice.
 * Everything is shrunk toward its expectation, so a pairing seen 3 times barely moves the result.
 */
export function createRealData(stats: DraftStats, keyOf: ReadonlyMap<string, number>, tagsOf: (key: number) => string[]): DraftData {
  const idOf = new Map([...keyOf].map(([id, key]) => [key, id])), champ = new Map(stats.champions.map((c) => [c.id, c]));
  const strength = (id: string) => { const c = champ.get(id); return c ? shrink(c.wins, c.games, 0.5, STRENGTH_PRIOR) : 0.5; };
  const edges = (pairs: DraftStats["matchups"], expected: (x: string, y: string) => number) => new Map(pairs.map(([x, y, games, wins]) => {
    const z = expected(x, y), obs = shrink(wins, games, sigmoid(z), PAIR_PRIOR);
    return [`${x}|${y}`, logit(obs) - z] as const;
  }));
  const lane = edges(stats.matchups, (x, y) => logit(strength(x)) - logit(strength(y)));      // x against y
  const team = edges(stats.synergies, (x, y) => logit(strength(x)) + logit(strength(y)));      // x with y
  return {
    strength: (c) => { const id = idOf.get(c); return id ? strength(id) : 0.5; },
    tags: tagsOf,
    roles: (c) => { const known = champ.get(idOf.get(c) ?? "")?.roles ?? []; return known.length ? (known as Role[]) : guessRoles(tagsOf(c)); },
    // Pairs are stored once with the first id alphabetically first; the reverse direction is the negative (matchup) or the same (synergy).
    matchup: (a, b) => { const x = idOf.get(a), y = idOf.get(b); if (!x || !y) return 0; return x < y ? lane.get(`${x}|${y}`) ?? 0 : -(lane.get(`${y}|${x}`) ?? 0); },
    synergy: (a, b) => { const x = idOf.get(a), y = idOf.get(b); if (!x || !y) return 0; return team.get(x < y ? `${x}|${y}` : `${y}|${x}`) ?? 0; },
  };
}

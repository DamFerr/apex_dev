import type { DraftData } from "./engine";
import { guessRoles } from "./roles";

/** TEST FIXTURE ONLY (not exported from the package): synthetic draft data for unit tests. The app only ever uses collected games. */
export interface ChampMeta { key: number; tags: string[] }
function rand(seed: number) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Class-vs-class edges (log-odds), so the synthetic data has believable structure instead of pure noise.
const EDGE: Record<string, Record<string, number>> = {
  Assassin: { Mage: 0.08, Marksman: 0.06, Fighter: -0.06 }, Fighter: { Assassin: 0.06, Tank: -0.04, Mage: 0.03 },
  Mage: { Assassin: -0.08, Fighter: -0.03, Tank: 0.05 }, Tank: { Mage: -0.05, Marksman: 0.04 }, Marksman: { Tank: -0.04, Assassin: -0.06 },
};
const SYN: Record<string, number> = { "Marksman+Support": 0.06, "Mage+Tank": 0.03, "Assassin+Support": 0.02, "Fighter+Support": 0.02 };

/** SYNTHETIC data for building and testing the engine. Deterministic per champion; not real statistics. */
export function createMockData(champs: ChampMeta[]): DraftData {
  const tagMap = new Map(champs.map((c) => [c.key, c.tags])), t0 = (k: number) => tagMap.get(k)?.[0] ?? "";
  const noise = (a: number, b: number) => rand(Math.min(a, b) * 100003 + Math.max(a, b))();
  return {
    strength: (c) => 0.46 + rand(c)() * 0.08,
    tags: (c) => tagMap.get(c) ?? [],
    roles: (c) => guessRoles(tagMap.get(c) ?? []),
    matchup: (a, b) => (EDGE[t0(a)]?.[t0(b)] ?? 0) - (EDGE[t0(b)]?.[t0(a)] ?? 0) + (a < b ? 1 : -1) * (noise(a, b) * 0.08 - 0.04),
    synergy: (a, b) => (SYN[[t0(a), t0(b)].sort().join("+")] ?? 0) + (noise(a + 7, b + 7) * 0.06 - 0.03),
  };
}

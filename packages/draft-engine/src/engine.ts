import type { Role } from "@apex/schema";
import { damageSkew, shortfall, teamComp, type CompBaseline, type CompProfile } from "./comp";

/** Where numbers come from. createRealData implements it from the games the collector has stored. */
export interface DraftData {
  strength(champion: number): number;            // win rate 0..1 for the champion on its own
  matchup(a: number, b: number): number;         // log-odds edge of a over b (must satisfy matchup(a,b) = -matchup(b,a))
  synergy(a: number, b: number): number;         // log-odds bonus when a and b are on the same team (symmetric)
  tags(champion: number): string[];
  roles(champion: number): Role[];
  /** Measured damage split, damage taken and CC of a champion, when collected games have it (optional). */
  /** `role`: the role the champion is picked in, when known; the answer is that role's numbers when it has enough games, else the champion's overall numbers. */
  profile?(champion: number, role?: Role | null): CompProfile | null;
  /** Typical damage taken and CC per player-minute over all collected games; with it Frontline and Crowd control are measured (optional). */
  baseline?(): CompBaseline | null;
}
export interface Pick { champion: number; role: Role | null }
export interface Factor { kind: "strength" | "matchup" | "synergy" | "comp" | "personal"; champs: number[]; label: string; z: number; pp: number }
export interface Evaluation { winProb: number; band: number; factors: Factor[] }
export interface Recommendation { champion: number; winProb: number; deltaPP: number; why?: Factor; note?: string }

const PP = 25; // log-odds to percentage points, valid near 50%
export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Picks with an unknown role (enemies are often unassigned) take their most likely free role. */
export function resolve(picks: Pick[], data: DraftData): Pick[] {
  const used = new Set(picks.map((p) => p.role).filter(Boolean));
  return picks.map((p) => {
    if (p.role) return p;
    const r = data.roles(p.champion).find((x) => !used.has(x)) ?? null;
    if (r) used.add(r);
    return { champion: p.champion, role: r };
  });
}

/** Layer B: team composition features. Returns log-odds contributions per feature for one team. */
function comp(picks: Pick[], data: DraftData): Record<string, number> {
  const n = picks.length, tags = picks.map((p) => data.tags(p.champion));
  const tc = teamComp(picks, (c, r) => data.profile?.(c, r), data.tags); // measured when every pick has games, else the class-tag estimate
  const base = data.baseline?.() ?? null;
  const has = (...k: string[]) => tags.some((t) => t.some((x) => k.includes(x)));
  // Measured: how much damage the team soaks up / how much CC it deals per minute against what n typical players do (same maximum
  // penalties as the tag rules). Not measured (new champion, few games, no baseline): the old class-tag checks, unchanged.
  const measured = tc.measured && base !== null && tc.takenPerMin !== null && tc.ccPerMin !== null;
  return {
    "Damage balance": n >= 3 ? -0.3 * Math.max(0, (damageSkew(tc) - 0.75) / 0.25) : 0,
    "Frontline": n < 4 ? 0 : measured ? -0.15 * shortfall(tc.takenPerMin!, base!.takenPerMin * n) : !has("Tank", "Fighter") ? -0.15 : 0,
    "Crowd control": n < 4 ? 0 : measured ? -0.1 * shortfall(tc.ccPerMin!, base!.ccPerMin * n) : !has("Tank", "Support") ? -0.1 : 0,
  };
}

/**
 * Win probability for your team. Layer A (strength + matchups + synergies) and layer B (comp) are summed in
 * log-odds space. Every term is antisymmetric, so evaluate(A, E) + evaluate(E, A) = 1.
 */
export function evaluate(allyIn: Pick[], enemyIn: Pick[], data: DraftData): Evaluation {
  const A = resolve(allyIn, data), E = resolve(enemyIn, data), factors: Factor[] = [];
  const add = (kind: Factor["kind"], champs: number[], label: string, z: number) => { if (Math.abs(z) > 1e-9) factors.push({ kind, champs, label, z, pp: z * PP }); };
  add("strength", [], "Champion strength", A.reduce((s, p) => s + logit(data.strength(p.champion)), 0) - E.reduce((s, p) => s + logit(data.strength(p.champion)), 0));
  for (const a of A) for (const e of E) if (a.role && a.role === e.role) add("matchup", [a.champion, e.champion], "Lane matchup", data.matchup(a.champion, e.champion));
  const pairs = (T: Pick[], sign: number) => T.forEach((x, i) => T.slice(i + 1).forEach((y) => add("synergy", [x.champion, y.champion], "Synergy", sign * data.synergy(x.champion, y.champion))));
  pairs(A, 1); pairs(E, -1);
  const ca = comp(A, data), ce = comp(E, data);
  for (const k of Object.keys(ca)) add("comp", [], k, ca[k] - ce[k]);
  const z = factors.reduce((s, f) => s + f.z, 0);
  // Uncertainty band: a heuristic that narrows as picks lock in. Real intervals come with the trained model.
  return { winProb: sigmoid(z), band: 0.02 + (0.1 * (10 - A.length - E.length)) / 10,
    factors: factors.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)) };
}

/** Ranks candidates for `role` by the win probability of the draft if you pick them. */
export function recommend(ally: Pick[], enemy: Pick[], role: Role, candidates: number[], data: DraftData,
  opts: { exclude?: Set<number>; limit?: number; personal?: (champion: number) => { z: number; note: string } | null } = {}): Recommendation[] {
  const base = evaluate(ally, enemy, data).winProb, out: Recommendation[] = [];
  for (const c of candidates) {
    if (opts.exclude?.has(c) || !data.roles(c).includes(role)) continue;
    const ev = evaluate([...ally, { champion: c, role }], enemy, data), per = opts.personal?.(c) ?? null;
    const winProb = per ? sigmoid(logit(ev.winProb) + per.z) : ev.winProb; // layer D: your own record on this champion
    const top = ev.factors.find((f) => f.champs.includes(c)) ?? ev.factors[0];
    const pf: Factor | undefined = per && Math.abs(per.z) > 1e-9 ? { kind: "personal", champs: [c], label: "Your history", z: per.z, pp: per.z * PP } : undefined;
    out.push({ champion: c, winProb, deltaPP: (winProb - base) * 100, note: per?.note, why: pf && (!top || Math.abs(pf.pp) >= Math.abs(top.pp)) ? pf : top });
  }
  return out.sort((a, b) => b.winProb - a.winProb).slice(0, opts.limit ?? 6);
}

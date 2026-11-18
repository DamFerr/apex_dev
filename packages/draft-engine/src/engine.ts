import type { Role } from "@apex/schema";
import { damageSkew, shortfall, teamComp, type CompBaseline, type CompProfile } from "./comp";
import { CROWD_CONTROL_MAX, DAMAGE_BALANCE_MAX, DAMAGE_FREE_SHARE, FRONTLINE_MAX, confidenceBand, logit, sigmoid, toPP } from "./model";

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

export { logit, sigmoid };

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

/** A term before it becomes a `Factor` (pp is derived from z in one place). */
type Term = Omit<Factor, "pp">;

/**
 * Layer A1, champion strength: summed logit win rate of your team minus the enemy's. `data.strength` is already shrunk
 * toward 50% (see `shrunkStrength`), so a rarely seen champion contributes close to nothing.
 */
export function strengthTerm(A: Pick[], E: Pick[], data: DraftData): Term[] {
  const sum = (T: Pick[]) => T.reduce((s, p) => s + logit(data.strength(p.champion)), 0);
  return [{ kind: "strength", champs: [], label: "Champion strength", z: sum(A) - sum(E) }];
}

/** Layer A2, lane matchups: every ally against the enemy picked in the same role. `data.matchup` is net of the two strengths. */
export function matchupTerms(A: Pick[], E: Pick[], data: DraftData): Term[] {
  const out: Term[] = [];
  for (const a of A) for (const e of E) if (a.role && a.role === e.role) out.push({ kind: "matchup", champs: [a.champion, e.champion], label: "Lane matchup", z: data.matchup(a.champion, e.champion) });
  return out;
}

/** Layer A3, synergies: every pair inside a team, signed +1 for your team and -1 for the enemy's. Net of the two strengths, so nothing is counted twice. */
export function synergyTerms(A: Pick[], E: Pick[], data: DraftData): Term[] {
  const out: Term[] = [];
  const pairs = (T: Pick[], sign: number) => T.forEach((x, i) => T.slice(i + 1).forEach((y) => out.push({ kind: "synergy", champs: [x.champion, y.champion], label: "Synergy", z: sign * data.synergy(x.champion, y.champion) })));
  pairs(A, 1); pairs(E, -1);
  return out;
}

/** Layer B, team composition for ONE team: log-odds lost per feature (always <= 0). Measured from collected games when every pick has enough, else class tags. */
export function compPenalties(picks: Pick[], data: DraftData): Record<string, number> {
  const n = picks.length, tags = picks.map((p) => data.tags(p.champion));
  const tc = teamComp(picks, (c, r) => data.profile?.(c, r), data.tags);
  const base = data.baseline?.() ?? null;
  const has = (...k: string[]) => tags.some((t) => t.some((x) => k.includes(x)));
  // Measured: damage soaked / CC dealt per minute against what n typical players do (hand-set maximum penalties, see model.ts).
  // Not measured (new champion, few games, no baseline): the class-tag checks.
  const measured = tc.measured && base !== null && tc.takenPerMin !== null && tc.ccPerMin !== null;
  return {
    "Damage balance": n >= 3 ? -DAMAGE_BALANCE_MAX * Math.max(0, (damageSkew(tc) - DAMAGE_FREE_SHARE) / (1 - DAMAGE_FREE_SHARE)) : 0,
    "Frontline": n < 4 ? 0 : measured ? -FRONTLINE_MAX * shortfall(tc.takenPerMin!, base!.takenPerMin * n) : !has("Tank", "Fighter") ? -FRONTLINE_MAX : 0,
    "Crowd control": n < 4 ? 0 : measured ? -CROWD_CONTROL_MAX * shortfall(tc.ccPerMin!, base!.ccPerMin * n) : !has("Tank", "Support") ? -CROWD_CONTROL_MAX : 0,
  };
}

/** Layer B as terms: your team's penalty minus the enemy's, so a worse enemy comp helps you. */
export function compTerms(A: Pick[], E: Pick[], data: DraftData): Term[] {
  const ca = compPenalties(A, data), ce = compPenalties(E, data);
  return Object.keys(ca).map((k) => ({ kind: "comp" as const, champs: [], label: k, z: ca[k] - ce[k] }));
}

/**
 * Win probability for your team: the layer terms are summed in log-odds space, then passed through a sigmoid.
 * Every term is antisymmetric, so evaluate(A, E) + evaluate(E, A) = 1. Layer D (personal) is applied in `recommend`, not here.
 */
export function evaluate(allyIn: Pick[], enemyIn: Pick[], data: DraftData): Evaluation {
  const A = resolve(allyIn, data), E = resolve(enemyIn, data);
  const factors: Factor[] = [...strengthTerm(A, E, data), ...matchupTerms(A, E, data), ...synergyTerms(A, E, data), ...compTerms(A, E, data)]
    .filter((t) => Math.abs(t.z) > 1e-9).map((t) => ({ ...t, pp: toPP(t.z) }));
  const z = factors.reduce((s, f) => s + f.z, 0);
  return { winProb: sigmoid(z), band: confidenceBand(A.length + E.length), factors: factors.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)) };
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
    const pf: Factor | undefined = per && Math.abs(per.z) > 1e-9 ? { kind: "personal", champs: [c], label: "Your history", z: per.z, pp: toPP(per.z) } : undefined;
    out.push({ champion: c, winProb, deltaPP: (winProb - base) * 100, note: per?.note, why: pf && (!top || Math.abs(pf.pp) >= Math.abs(top.pp)) ? pf : top });
  }
  return out.sort((a, b) => b.winProb - a.winProb).slice(0, opts.limit ?? 6);
}

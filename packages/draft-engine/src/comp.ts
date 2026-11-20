import type { Role } from "@apex/schema";
import type { Pick } from "./engine";

/** Fewer measured games than this and a champion's damage numbers are not trusted; the class-tag estimate is used instead. */
export const MIN_PROFILE_GAMES = 20;

/** Sums over the collected games of one champion (see `CompProfileRow` in @apex/schema). */
export interface CompProfile {
  games: number; phys: number; magic: number; trueDmg: number; taken: number; cc: number; seconds: number;
  /** Peel (E.2e): heals + shields on teammates over the `peelGames` games that carry them, and those games' seconds. Absent = no game carries them (never 0). */
  peelGames?: number; heals?: number; shields?: number; peelSeconds?: number;
}
/** Fewer Peel games than this behind a pick and the team's Peel is not measured (same bar as the damage numbers). */
export const MIN_PEEL_GAMES = MIN_PROFILE_GAMES;

/** What one team brings. Shares add up to 1. `measured` = every pick came from collected games; otherwise the split is a class-tag estimate. */
export interface TeamComp {
  picks: number; measuredPicks: number; measured: boolean;
  ad: number; ap: number; trueShare: number;
  /** Per minute, summed over the team. null when not measured (never invented from class tags). */
  takenPerMin: number | null; ccPerMin: number | null;
  /** Heals plus shields on teammates per minute, summed over the team (Peel). Needs EVERY pick to have `MIN_PEEL_GAMES` Peel games, else null. Measured separately from the damage split: Peel data only exists for games collected after E.2e. */
  peelPerMin: number | null;
  /** Fewest Peel games behind any pick when `peelPerMin` is measured (the thinnest link), else 0. */
  peelGames: number;
}

/** The class-tag rule the engine always used: Mage and Support lean on ability power, everything else on attack damage. */
const leansAp = (tags: string[]) => tags[0] === "Mage" || tags[0] === "Support";

/** Peel of a team: per-minute heals + shields summed over the picks, and the fewest games behind a pick. All-or-nothing, like the damage path. Pure. */
export function teamPeel(looked: readonly (CompProfile | null | undefined)[]): { peelPerMin: number | null; peelGames: number } {
  let perMin = 0, games = Infinity;
  for (const c of looked) {
    if (!c || (c.peelGames ?? 0) < MIN_PEEL_GAMES || !((c.peelSeconds ?? 0) > 0)) return { peelPerMin: null, peelGames: 0 };
    perMin += (((c.heals ?? 0) + (c.shields ?? 0)) * 60) / c.peelSeconds!; games = Math.min(games, c.peelGames!);
  }
  return looked.length ? { peelPerMin: perMin, peelGames: games } : { peelPerMin: null, peelGames: 0 };
}

/**
 * Damage split, tankiness and CC of a team from its locked picks.
 * Measured: each champion's average damage per minute by type is summed, so a carry counts for more than a support.
 * The measured path needs EVERY pick to have `MIN_PROFILE_GAMES` games; mixing damage-per-minute with pick counts would be
 * meaningless, so otherwise the whole split is the tag estimate (the same rule as before this module existed).
 */
export function teamComp(picks: Pick[], profile: (champion: number, role: Role | null) => CompProfile | null | undefined, tags: (champion: number) => string[]): TeamComp {
  const looked = picks.map((p) => profile(p.champion, p.role)), peel = teamPeel(looked);   // one lookup per pick
  const profiles = looked.map((p) => (p && p.games >= MIN_PROFILE_GAMES && p.seconds > 0 ? p : null));
  const measuredPicks = profiles.filter(Boolean).length, n = picks.length;
  if (n > 0 && measuredPicks === n) {
    let phys = 0, magic = 0, tru = 0, taken = 0, cc = 0;
    for (const p of profiles as CompProfile[]) { const m = 60 / p.seconds; phys += p.phys * m; magic += p.magic * m; tru += p.trueDmg * m; taken += p.taken * m; cc += p.cc * m; }
    const total = phys + magic + tru;
    if (total > 0) return { picks: n, measuredPicks, measured: true, ad: phys / total, ap: magic / total, trueShare: tru / total, takenPerMin: taken, ccPerMin: cc, ...peel };
  }
  const ap = picks.filter((p) => leansAp(tags(p.champion))).length;
  return { picks: n, measuredPicks, measured: false, ad: n ? (n - ap) / n : 0, ap: n ? ap / n : 0, trueShare: 0, takenPerMin: null, ccPerMin: null, ...peel };
}

/** What `DraftData.scaling` answers for one champion in a role: late minus early win rate as a fraction, and the games behind it. */
export interface ScalingScore { score: number; games: number }

/** Scaling of one team (E.2d). `score` = mean over ALL picks, a pick without a measured score counts 0; `games` = early plus late games over the measured picks. */
export interface TeamScaling { picks: number; measuredPicks: number; score: number; games: number }

/** Averages the measured scaling of a team's picks. Picks without a role or without enough games are neutral, so a thin team stays near 0 instead of being extrapolated. */
export function teamScaling(picks: Pick[], scaling: (champion: number, role: Role | null) => ScalingScore | null | undefined): TeamScaling {
  let sum = 0, games = 0, measuredPicks = 0;
  for (const p of picks) { const s = scaling(p.champion, p.role); if (s) { sum += s.score; games += s.games; measuredPicks++; } }
  return { picks: picks.length, measuredPicks, score: picks.length ? sum / picks.length : 0, games };
}

/** The larger of the two main damage types, as a 0..1 share. 0 for an empty team. */
export const damageSkew = (c: TeamComp) => Math.max(c.ad, c.ap);

/** What a typical player takes and CC's per minute, over every collected champion (not per champion). The yardstick for "enough frontline / CC". */
export interface CompBaseline { takenPerMin: number; ccPerMin: number }
/** Fewest player-games behind the baseline; below it there is no yardstick and the engine keeps the class-tag rules. */
export const MIN_BASELINE_GAMES = 200;

/** Time-weighted average damage taken and CC per minute over all profiles, or null with too little data. */
export function profileBaseline(profiles: CompProfile[], minGames = MIN_BASELINE_GAMES): CompBaseline | null {
  let games = 0, seconds = 0, taken = 0, cc = 0;
  for (const p of profiles) { if (p.seconds <= 0) continue; games += p.games; seconds += p.seconds; taken += p.taken; cc += p.cc; }
  if (games < minGames || seconds <= 0 || taken <= 0 || cc <= 0) return null;
  return { takenPerMin: (taken * 60) / seconds, ccPerMin: (cc * 60) / seconds };
}

/**
 * How far below the expected amount a team is, 0..1: 0 at `hi` (80%) of the expected value or more, 1 at `lo` (40%) or less, linear between.
 * Continuous on purpose, so one champion more or less does not flip a penalty on and off. Hand-set thresholds, not learned.
 */
export function shortfall(value: number, expected: number, lo = 0.4, hi = 0.8): number {
  if (!(expected > 0) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (hi - value / expected) / (hi - lo)));
}

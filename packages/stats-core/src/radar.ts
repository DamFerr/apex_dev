import { perfGrade, performanceScore, type PerfGrade } from "./index";

/**
 * Skill radar (plan 6.6, step R.1): five axes of a player's recent games, each scored 0..100 against a reference average.
 * Pure. The caller supplies the games and the reference (R.2 builds both on the backend); this file only does the maths.
 */

/** One finished game of the player. `minutes` is the game length; zero or negative minutes make the game unusable. */
export interface RadarGame { kills: number; deaths: number; assists: number; cs: number; damage: number; gold: number; vision: number; minutes: number }

export type RadarAxisId = "fighting" | "farming" | "damage" | "economy" | "vision";
/** Reference averages for the same five measures (KDA, CS/min, damage/min, gold/min, vision/min). null = no reference for that axis. */
export type RadarReference = Record<RadarAxisId, number | null>;

export interface RadarAxis {
  id: RadarAxisId;
  /** The player's value: KDA for fighting, otherwise a per-minute rate. */
  value: number;
  /** The reference value it was compared with. */
  reference: number;
  /** 0..100, 50 = exactly the reference (same scale and letters as the post-game grade). */
  score: number;
  letter: PerfGrade;
}
export interface SkillRadar {
  /** Games actually used (unusable games are dropped). */
  games: number;
  /** True under `MIN_RADAR_GAMES`: the UI shows LOW DATA, never presents it as a verdict. */
  low: boolean;
  /** Only axes that have a usable reference AND data; may be shorter than 5. */
  axes: RadarAxis[];
  /** Mean of the axis scores, null with fewer than `MIN_RADAR_AXES` axes. */
  overall: number | null;
  /** Highest and lowest axis (null when fewer than 2 axes, or all equal). Evidence for a later strengths/weaknesses report. */
  best: RadarAxisId | null;
  worst: RadarAxisId | null;
}

/** Same line as the rest of the app would call "low data" for one player's own games (a player has far fewer games than a champion). */
export const MIN_RADAR_GAMES = 10;
/** Fewer scored axes than this and no overall number (never an overall from one or two numbers). */
export const MIN_RADAR_AXES = 3;
export const RADAR_AXES: RadarAxisId[] = ["fighting", "farming", "damage", "economy", "vision"];

const usable = (g: RadarGame) =>
  g.minutes > 0 && [g.kills, g.deaths, g.assists, g.cs, g.damage, g.gold, g.vision, g.minutes].every((n) => Number.isFinite(n) && n >= 0);

/**
 * Totals-over-totals, not an average of per-game ratios: one 8-minute remake cannot outweigh a 40-minute game.
 * Fighting is KDA = (kills + assists) / max(1, deaths), so a deathless stretch stays finite.
 */
export function radarValues(games: RadarGame[]): Record<RadarAxisId, number> | null {
  const g = games.filter(usable);
  if (g.length === 0) return null;
  const sum = (f: (x: RadarGame) => number) => g.reduce((a, x) => a + f(x), 0);
  const minutes = sum((x) => x.minutes);
  return {
    fighting: (sum((x) => x.kills) + sum((x) => x.assists)) / Math.max(1, sum((x) => x.deaths)),
    farming: sum((x) => x.cs) / minutes,
    damage: sum((x) => x.damage) / minutes,
    economy: sum((x) => x.gold) / minutes,
    vision: sum((x) => x.vision) / minutes,
  };
}

export function skillRadar(games: RadarGame[], reference: RadarReference): SkillRadar {
  const used = games.filter(usable);
  const values = radarValues(used);
  const axes: RadarAxis[] = [];
  if (values) {
    for (const id of RADAR_AXES) {
      const ref = reference[id];
      if (ref === null || !Number.isFinite(ref) || ref <= 0) continue;
      // One ratio through the shared score: 50 = equal to the reference, 1.5x is about 88, clamped so a freak value cannot dominate.
      const score = performanceScore([values[id] / ref]);
      if (score === null) continue;
      axes.push({ id, value: values[id], reference: ref, score, letter: perfGrade(score) });
    }
  }
  const overall = axes.length >= MIN_RADAR_AXES ? Math.round(axes.reduce((a, x) => a + x.score, 0) / axes.length) : null;
  const sorted = [...axes].sort((a, b) => b.score - a.score);
  const spread = sorted.length >= 2 && sorted[0].score !== sorted[sorted.length - 1].score;
  return {
    games: used.length,
    low: used.length < MIN_RADAR_GAMES,
    axes,
    overall,
    best: spread ? sorted[0].id : null,
    worst: spread ? sorted[sorted.length - 1].id : null,
  };
}

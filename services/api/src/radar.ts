import { skillRadar, type RadarGame, type RadarReference } from "@apex/stats-core";
import type { PlayerRadar, Role } from "@apex/schema";
import { roleOf } from "./mapping";
import type { RiotMatch } from "./riot";

/** Games of the player used at most, and the collected games a reference needs (same line as the recap baseline: fewer is too noisy). */
export const RADAR_MAX_GAMES = 50, MIN_REFERENCE_GAMES = 30;
/** Games shorter than this (remakes, early surrenders) are left out on both sides, as in the store's reference. */
export const MIN_RADAR_SECONDS = 300;

/** What the store reports for a group of collected games (`store.radarReference`). */
export interface RadarRefRow { games: number; kda: number; cs: number; damage: number; gold: number }
export interface PickedReference { values: RadarReference; info: NonNullable<PlayerRadar["reference"]> }

const tierLabel = (t: string) => t[0] + t.slice(1).toLowerCase();
const roleLabel = (r: Role) => (r === "ADC" ? "ADC" : r[0] + r.slice(1).toLowerCase());

/** The role the player played most in these games (ties: the one seen first, i.e. the newest game). Null when no game has a known role. Pure. */
export function mostPlayedRole(matches: readonly RiotMatch[], puuid: string): Role | null {
  const count = new Map<Role, number>();
  for (const m of matches) {
    const me = m.info.participants.find((p) => p.puuid === puuid), role = me ? roleOf(me.teamPosition) : null;
    if (role && m.info.gameDuration >= MIN_RADAR_SECONDS) count.set(role, (count.get(role) ?? 0) + 1);
  }
  let best: Role | null = null;
  for (const [role, n] of count) if (best === null || n > count.get(best)!) best = role;
  return best;
}

/** The player's games in `role` as radar input. Remakes and games where the player is missing are dropped. Pure. */
export function toRadarGames(matches: readonly RiotMatch[], puuid: string, role: Role): RadarGame[] {
  const out: RadarGame[] = [];
  for (const m of matches) {
    const me = m.info.participants.find((p) => p.puuid === puuid);
    if (!me || roleOf(me.teamPosition) !== role || m.info.gameDuration < MIN_RADAR_SECONDS) continue;
    out.push({
      kills: me.kills, deaths: me.deaths, assists: me.assists, cs: me.totalMinionsKilled + me.neutralMinionsKilled,
      damage: me.totalDamageDealtToChampions, gold: me.goldEarned, vision: me.visionScore ?? 0, minutes: m.info.gameDuration / 60,
    });
  }
  return out;
}

/**
 * The most specific reference with enough collected games: the player's rank tier first, then all ranks. Null when neither has `MIN_REFERENCE_GAMES`.
 * `read` asks the store (`store.radarReference`). Vision has NO reference: the collector does not store vision score, so that axis is skipped
 * (a later step can add the column; the radar needs no change). Pure apart from `read`.
 */
export function pickReference(role: Role, tier: string | undefined, read: (bracket?: string) => RadarRefRow): PickedReference | null {
  const tries = [...(tier ? [{ bracket: tier as string | undefined, label: `${tierLabel(tier)} ${roleLabel(role)}`, tier }] : []), { bracket: undefined, label: `${roleLabel(role)}, all ranks`, tier: undefined }];
  for (const t of tries) {
    const r = read(t.bracket);
    if (r.games >= MIN_REFERENCE_GAMES) {
      return { values: { fighting: r.kda, farming: r.cs, damage: r.damage, economy: r.gold, vision: null }, info: { label: `${t.label} (Ranked Solo)`, games: r.games, tier: t.tier ?? null } };
    }
  }
  return null;
}

/**
 * The profile radar: the player's games (newest first, already filtered by queue) in one role against the picked reference.
 * `role` undefined = the most played role. No role or no reference gives an empty radar, never a made-up one. Pure.
 */
export function toPlayerRadar(matches: readonly RiotMatch[], puuid: string, role: Role | undefined, pick: (role: Role) => PickedReference | null): PlayerRadar {
  const r = role ?? mostPlayedRole(matches, puuid);
  if (!r) return { role: null, games: 0, low: true, axes: [], overall: null, best: null, worst: null, reference: null };
  const games = toRadarGames(matches.slice(0, RADAR_MAX_GAMES), puuid, r), ref = pick(r);
  const radar = skillRadar(games, ref?.values ?? { fighting: null, farming: null, damage: null, economy: null, vision: null });
  return { role: r, games: radar.games, low: radar.low, axes: radar.axes, overall: radar.overall, best: radar.best, worst: radar.worst, reference: ref?.info ?? null };
}

import type { RiotTimeline } from "./riot";

/** What Apex keeps from one player's match timeline. Skill slots are 1 to 4 (Q, W, E, R), in the order the points were spent. */
export interface PlayerTimeline { skills: number[]; start: number[]; buys: number[]; /** Gold, CS and XP at each of `LANE_MINUTES` (3 numbers per minute, in that order); null where the game was shorter. Absent when the timeline has no frame data. */ lane?: (number | null)[] }
/** Minutes at which lane diffs are read. Riot's frames come every 60 s, so minute 10 is the frame at about 10:00. */
export const LANE_MINUTES = [10, 15, 20] as const;
const FRAME_TOLERANCE_MS = 5_000;

/** [gold, cs, xp] of one player at `minute`, or null when no frame sits there (a game that ended earlier, or no data). CS counts lane minions and jungle monsters. */
function snapshot(tl: RiotTimeline, id: number, minute: number): [number, number, number] | null {
  const f = tl.info.frames.find((fr) => fr.timestamp !== undefined && Math.abs(fr.timestamp - minute * 60_000) <= FRAME_TOLERANCE_MS)?.participantFrames?.[String(id)];
  if (!f || typeof f.totalGold !== "number" || typeof f.xp !== "number") return null;
  return [f.totalGold, (f.minionsKilled ?? 0) + (f.jungleMinionsKilled ?? 0), f.xp];
}
/** Purchases up to this time count as starting items. The fountain shop is the only place to buy before 1:30, so this cannot catch a later recall. */
export const START_MS = 90_000;
const MAX_BUYS = 40;

/**
 * One timeline -> per player (puuid): skill order, starting items and every later purchase in order.
 * An undone purchase (ITEM_UNDO) is removed again, so a misclick never shows up as a build choice. Pure, so it is unit tested.
 */
export function extractTimeline(tl: RiotTimeline): Map<string, PlayerTimeline> {
  const events = tl.info.frames.flatMap((f) => f.events ?? []).sort((a, b) => a.timestamp - b.timestamp); // stable: same-time events keep their order
  const out = new Map<string, PlayerTimeline>();
  tl.metadata.participants.forEach((puuid, i) => {
    const id = i + 1, skills: number[] = [], bought: { item: number; t: number }[] = [];
    for (const e of events) {
      if (e.participantId !== id) continue;
      if (e.type === "ITEM_PURCHASED" && e.itemId) bought.push({ item: e.itemId, t: e.timestamp });
      else if (e.type === "ITEM_UNDO" && e.beforeId) { const at = bought.map((b) => b.item).lastIndexOf(e.beforeId); if (at >= 0) bought.splice(at, 1); }
      else if (e.type === "SKILL_LEVEL_UP" && e.levelUpType === "NORMAL" && e.skillSlot && e.skillSlot >= 1 && e.skillSlot <= 4) skills.push(e.skillSlot);
    }
    const shots = LANE_MINUTES.map((m) => snapshot(tl, id, m)), t: PlayerTimeline = { skills: skills.slice(0, 18), start: bought.filter((b) => b.t <= START_MS).map((b) => b.item), buys: bought.filter((b) => b.t > START_MS).map((b) => b.item).slice(0, MAX_BUYS) };
    if (shots.some((s) => s)) t.lane = shots.flatMap((s) => s ?? [null, null, null]); // key only set when there is data, so a timeline without frames looks as before
    out.set(puuid, t);
  });
  return out;
}

/** A stable number 0..999 per match (hash of its id). A game is in a timeline share when its bucket is below share * 1000, so the same games are chosen on every run, in tests, and by the backfill. */
export function timelineBucket(matchId: string): number {
  let h = 2166136261; for (let i = 0; i < matchId.length; i++) h = Math.imul(h ^ matchId.charCodeAt(i), 16777619) >>> 0;
  return h % 1000;
}
/** Deterministic pick of a share (0 to 1) of matches. */
export const inShare = (matchId: string, share: number): boolean => timelineBucket(matchId) < share * 1000;

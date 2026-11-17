import type { RiotTimeline } from "./riot";

/** What Apex keeps from one player's match timeline. Skill slots are 1 to 4 (Q, W, E, R), in the order the points were spent. */
export interface PlayerTimeline { skills: number[]; start: number[]; buys: number[] }
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
    out.set(puuid, { skills: skills.slice(0, 18), start: bought.filter((b) => b.t <= START_MS).map((b) => b.item), buys: bought.filter((b) => b.t > START_MS).map((b) => b.item).slice(0, MAX_BUYS) });
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

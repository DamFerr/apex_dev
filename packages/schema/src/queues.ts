/**
 * Queue filters for match history. One definition used by the desktop app (chips) and the local backend (what to ask Riot for).
 * Allow-list (H.3a, owner decision): only the named groups are ever shown, "All" included. Everything else (Brawl, League Classic, Swiftplay,
 * Quickplay, Blind, rotating modes, unknown ids) is hidden, in line with COMPLIANCE.md. Ids checked against Riot's queues.json and recent reports (Nov 2026):
 * 420 Ranked Solo/Duo, 440 Ranked Flex, 400 Normal Draft, 450 ARAM. Arena has used several ids (1700, 1710, and 1740 / 1750 for the three-player
 * version, the last two missing from queues.json), so it is a list. ARAM Mayhem (2400) is private in Match-v5 and never appears, so it has no chip.
 * Riot's ids call takes ONE queue id, so groups with a single id are filtered by Riot, "All" and Arena by the backend after loading each match.
 */
export type QueueFilter = "all" | "solo" | "flex" | "normal" | "aram" | "arena";
export interface QueueFilterDef { key: QueueFilter; label: string; /** Queue ids of the group; null for "all" (every named group). */ ids: number[] | null }
export const QUEUE_FILTERS: QueueFilterDef[] = [
  { key: "all", label: "All", ids: null },
  { key: "solo", label: "Ranked Solo/Duo", ids: [420] },
  { key: "flex", label: "Ranked Flex", ids: [440] },
  { key: "normal", label: "Normal Draft", ids: [400] },
  { key: "aram", label: "ARAM", ids: [450] },
  { key: "arena", label: "Arena", ids: [1700, 1710, 1740, 1750] },
];
export const isQueueFilter = (x: unknown): x is QueueFilter => QUEUE_FILTERS.some((f) => f.key === x);
/** The group a queue id belongs to, or null when it is in no named group (such games are never shown). */
export function queueGroupOf(queueId: number): Exclude<QueueFilter, "all"> | null {
  return (QUEUE_FILTERS.find((f) => f.ids?.includes(queueId))?.key ?? null) as Exclude<QueueFilter, "all"> | null;
}
/** Does a game of this queue belong to the filter? "all" means any named group, nothing else. */
export const matchesQueueFilter = (filter: QueueFilter, queueId: number) => { const g = queueGroupOf(queueId); return g !== null && (filter === "all" || g === filter); };
/** The single queue id Riot can filter by for this filter, or undefined when Riot cannot (all, Arena). */
export const riotQueueOf = (filter: QueueFilter): number | undefined => { const ids = QUEUE_FILTERS.find((f) => f.key === filter)?.ids; return ids && ids.length === 1 ? ids[0] : undefined; };

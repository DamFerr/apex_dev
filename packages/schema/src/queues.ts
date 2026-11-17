/**
 * Queue filters for match history. One definition used by the desktop app (chips) and the local backend (what to ask Riot for).
 * Ids checked against Riot's queues.json and recent reports (Nov 2026): 420 Ranked Solo/Duo, 440 Ranked Flex, 400 Normal Draft, 430 Normal Blind,
 * 450 ARAM. Arena has used several ids (1700, 1710, and 1740 / 1750 for the three-player version, the last two missing from queues.json),
 * so it is a list. ARAM Mayhem (2400) is private in Match-v5 and never appears. "other" is everything that is not one of the named groups.
 * Riot's ids call takes ONE queue id, so groups with a single id are filtered by Riot, the others (Arena, Other) by the backend after loading each match.
 */
export type QueueFilter = "all" | "solo" | "flex" | "normal" | "blind" | "aram" | "arena" | "other";
export interface QueueFilterDef { key: QueueFilter; label: string; /** Queue ids of the group; null for "all", empty for "other" (the rest). */ ids: number[] | null }
export const QUEUE_FILTERS: QueueFilterDef[] = [
  { key: "all", label: "All", ids: null },
  { key: "solo", label: "Ranked Solo/Duo", ids: [420] },
  { key: "flex", label: "Ranked Flex", ids: [440] },
  { key: "normal", label: "Normal Draft", ids: [400] },
  { key: "blind", label: "Blind", ids: [430] },
  { key: "aram", label: "ARAM", ids: [450] },
  { key: "arena", label: "Arena", ids: [1700, 1710, 1740, 1750] },
  { key: "other", label: "Other", ids: [] },
];
export const isQueueFilter = (x: unknown): x is QueueFilter => QUEUE_FILTERS.some((f) => f.key === x);
/** The group a queue id belongs to ("other" when it is in no named group). */
export function queueGroupOf(queueId: number): Exclude<QueueFilter, "all"> {
  return (QUEUE_FILTERS.find((f) => f.ids?.includes(queueId))?.key ?? "other") as Exclude<QueueFilter, "all">;
}
/** Does a game of this queue belong to the filter? */
export const matchesQueueFilter = (filter: QueueFilter, queueId: number) => filter === "all" || queueGroupOf(queueId) === filter;
/** The single queue id Riot can filter by for this filter, or undefined when Riot cannot (all, Arena, Other). */
export const riotQueueOf = (filter: QueueFilter): number | undefined => { const ids = QUEUE_FILTERS.find((f) => f.key === filter)?.ids; return ids && ids.length === 1 ? ids[0] : undefined; };

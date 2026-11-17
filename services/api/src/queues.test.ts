import { describe, expect, it } from "vitest";
import { isQueueFilter, matchesQueueFilter, queueGroupOf, QUEUE_FILTERS, riotQueueOf } from "@apex/schema";

describe("queue filters", () => {
  it("maps the known queue ids to their group", () => {
    expect([420, 440, 400, 430, 450].map(queueGroupOf)).toEqual(["solo", "flex", "normal", "blind", "aram"]);
    expect([1700, 1710, 1740, 1750].map(queueGroupOf)).toEqual(["arena", "arena", "arena", "arena"]);
  });
  it("puts everything else (Swiftplay, Quickplay, rotating modes, unknown ids) in Other", () => {
    for (const id of [480, 490, 700, 900, 2400, 123456]) expect(queueGroupOf(id)).toBe("other");
  });
  it("no queue id belongs to two groups", () => {
    const all = QUEUE_FILTERS.flatMap((f) => f.ids ?? []); expect(new Set(all).size).toBe(all.length);
  });
  it("matchesQueueFilter: All matches everything, a group only its own ids", () => {
    expect(matchesQueueFilter("all", 999)).toBe(true); expect(matchesQueueFilter("solo", 420)).toBe(true);
    expect(matchesQueueFilter("solo", 440)).toBe(false); expect(matchesQueueFilter("other", 420)).toBe(false); expect(matchesQueueFilter("other", 480)).toBe(true);
  });
  it("only single-id groups can be filtered by Riot", () => {
    expect(riotQueueOf("solo")).toBe(420); expect(riotQueueOf("aram")).toBe(450);
    expect(riotQueueOf("all")).toBeUndefined(); expect(riotQueueOf("arena")).toBeUndefined(); expect(riotQueueOf("other")).toBeUndefined();
  });
  it("isQueueFilter accepts exactly the known keys", () => {
    expect(isQueueFilter("flex")).toBe(true); expect(isQueueFilter("bogus")).toBe(false); expect(isQueueFilter(undefined)).toBe(false);
  });
});

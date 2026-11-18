import { describe, expect, it } from "vitest";
import { fetchStoredPlayers } from "./storedPlayers";

const reply = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

describe("fetchStoredPlayers", () => {
  it("returns the players and asks for /v1/players with q and limit", async () => {
    let url = "";
    const f = (async (u: string) => { url = u; return { ok: true, json: async () => [{ riotId: "Faker#KR1", seenAt: 5 }] }; }) as unknown as typeof fetch;
    expect(await fetchStoredPlayers("http://127.0.0.1:8787", "fak er", undefined, f)).toEqual([{ riotId: "Faker#KR1", seenAt: 5 }]);
    expect(url).toBe("http://127.0.0.1:8787/v1/players?q=fak+er&limit=8");
  });
  it("drops malformed items", async () => {
    const r = await fetchStoredPlayers("b", "fa", undefined, reply([{ riotId: "A#1", seenAt: 1 }, { riotId: 5 }, null, { riotId: "", seenAt: 1 }, "x"]));
    expect(r).toEqual([{ riotId: "A#1", seenAt: 1 }]);
  });
  it("gives [] for an error status, a non-list answer and an unreachable backend", async () => {
    expect(await fetchStoredPlayers("b", "fa", undefined, reply([], false))).toEqual([]);
    expect(await fetchStoredPlayers("b", "fa", undefined, reply({ error: "x" }))).toEqual([]);
    expect(await fetchStoredPlayers("b", "fa", undefined, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch)).toEqual([]);
  });
  it("rethrows an abort so a cancelled request is not cached as empty", async () => {
    const f = (async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }) as unknown as typeof fetch;
    await expect(fetchStoredPlayers("b", "fa", undefined, f)).rejects.toThrow("aborted");
  });
});

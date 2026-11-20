import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpApi } from "./http";

const radar = { role: null, games: 0, low: true, axes: [], overall: null, best: null, worst: null, reference: null };

/** Runs `call` against a stubbed fetch and returns the URL it asked for. */
async function urlOf(call: (api: ReturnType<typeof createHttpApi>) => Promise<unknown>): Promise<string> {
  let url = "";
  vi.stubGlobal("fetch", async (u: string) => { url = u; return { ok: true, json: async () => radar }; });
  await call(createHttpApi(() => "http://127.0.0.1:8787"));
  return url;
}

afterEach(() => vi.unstubAllGlobals());

describe("getRadar", () => {
  it("sends no params for the defaults (all queues, most played role)", async () =>
    expect(await urlOf((a) => a.getRadar("Faker#KR1"))).toBe("http://127.0.0.1:8787/v1/players/Faker%23KR1/radar?"));
  it("treats queue \"all\" as no queue param", async () =>
    expect(await urlOf((a) => a.getRadar("Faker#KR1", "all"))).toBe("http://127.0.0.1:8787/v1/players/Faker%23KR1/radar?"));
  it("sends queue and role when given", async () =>
    expect(await urlOf((a) => a.getRadar("Faker#KR1", "solo", "MID"))).toBe("http://127.0.0.1:8787/v1/players/Faker%23KR1/radar?queue=solo&role=MID"));
  it("returns the backend body unchanged", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => radar }));
    expect(await createHttpApi(() => "b").getRadar("A#1")).toEqual(radar);
  });
});

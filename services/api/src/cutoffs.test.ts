import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { apexCutoffs } from "./cutoffs";
import { fakeDD, fakeRiot, idleCollector, memoryCache, seededStore } from "./testkit";

const league = (...lps: number[]) => ({ entries: lps.map((leaguePoints) => ({ leaguePoints })) });

const lists = (master: number[], grandmaster: number[], challenger: number[]) => ({ master: league(...master), grandmaster: league(...grandmaster), challenger: league(...challenger) });

describe("apexCutoffs", () => {
  it("falls back to the lowest LP of Riot's lists where the seats are unknown or not filled", () => {
    expect(apexCutoffs("euw1", lists([300, 200], [500, 400, 650], [900, 700]), "t")).toEqual({ platform: "euw1", grandmaster: 400, challenger: 700, at: "t" });  // 7 players, 1000 seats
    expect(apexCutoffs("me1", lists([300], [500, 400], [900, 700]), "t")).toMatchObject({ grandmaster: 400, challenger: 700 });
  });
  it("ranks the pooled ladder by LP and reads the last seat (50 Challenger + 100 Grandmaster seats)", () => {
    // 200 players with LP 1000..1199: the top 50 are 1199..1150, the top 150 end at 1050; Riot's stale lists would say otherwise
    const lps = Array.from({ length: 200 }, (_, i) => 1000 + i);
    const c = apexCutoffs("oc1", lists(lps.slice(0, 120), lps.slice(120, 150), lps.slice(150)), "t");
    expect(c).toMatchObject({ challenger: 1150, grandmaster: 1050 });
  });
  it("uses the seat cut-off for one tier and the list for the other when only one is filled", () => {
    const lps = Array.from({ length: 80 }, (_, i) => 1000 + i);   // 80 players: Challenger (50) filled, Grandmaster (150) not
    const c = apexCutoffs("jp1", lists(lps.slice(0, 40), lps.slice(40, 60), lps.slice(60)), "t");
    expect(c.challenger).toBe(1030);
    expect(c.grandmaster).toBe(1040);   // lowest of the grandmaster list
  });
  it("gives null for empty lists", () => {
    expect(apexCutoffs("oc1", lists([], [], []), "t")).toMatchObject({ grandmaster: null, challenger: null });
  });
});

describe("GET /v1/ladder/:platform/cutoffs", () => {
  let app: Awaited<ReturnType<typeof buildApp>>, riot: ReturnType<typeof fakeRiot>;
  beforeEach(async () => {
    riot = fakeRiot(); const store = seededStore();
    app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
  });
  it("returns both cut-offs and reads Riot once per platform for repeated requests", async () => {
    const a = (await app.inject({ method: "GET", url: "/v1/ladder/euw1/cutoffs" })).json();
    expect(a).toMatchObject({ platform: "euw1", grandmaster: 400, challenger: 700 });
    expect(Date.parse(a.at)).not.toBeNaN();
    await app.inject({ method: "GET", url: "/v1/ladder/EUW1/cutoffs" });
    expect(riot.calls.apexLeague).toBe(3);   // master + grandmaster + challenger, once
  });
  it("rejects an unknown platform", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/ladder/mars1/cutoffs" })).statusCode).toBe(400);
  });
});

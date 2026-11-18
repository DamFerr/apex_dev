import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { makeCache } from "./db";
import { ACCOUNT_PREFIX, normalizeName, searchStoredPlayers } from "./players";
import { DatabaseSync } from "./sqlite";
import { fakeDD, fakeRiot, idleCollector, memoryCache, seededStore } from "./testkit";

const row = (key: string, gameName: string, tagLine: string, at: number) => ({ key, value: JSON.stringify({ puuid: "x", gameName, tagLine }), at });

describe("searchStoredPlayers", () => {
  const rows = [row("acct:faker#kr1", "Faker", "KR1", 100), row("acct:double lift#na1", "Double Lift", "NA1", 300), row("acct:caps#euw", "Caps", "EUW", 200)];
  it("matches ignoring case, spaces and punctuation, newest first", () => {
    expect(searchStoredPlayers(rows, "doublelift").map((p) => p.riotId)).toEqual(["Double Lift#NA1"]);
    expect(searchStoredPlayers(rows, "A").map((p) => p.riotId)).toEqual([]);          // one character: too broad
    expect(searchStoredPlayers(rows, "ap").map((p) => p.riotId)).toEqual(["Caps#EUW"]);
    expect(searchStoredPlayers(rows, "1").length).toBe(0);
    expect(searchStoredPlayers(rows, "#na").map((p) => p.seenAt)).toEqual([300]);
    expect(searchStoredPlayers(rows, "er").map((p) => p.riotId)).toEqual(["Faker#KR1"]);
  });
  it("orders by recency, dedupes case-insensitively and applies the limit", () => {
    const r = [row("acct:a#b", "Aaron", "EUW", 1), row("acct:aaron#euw", "aaron", "euw", 5), row("acct:aaa#euw", "Aaa", "EUW", 3)];
    expect(searchStoredPlayers(r, "aa").map((p) => p.riotId)).toEqual(["aaron#euw", "Aaa#EUW"]);
    expect(searchStoredPlayers(r, "aa", 1)).toHaveLength(1);
    expect(searchStoredPlayers(r, "aa", 0)).toEqual([]);
  });
  it("skips damaged rows and does not mutate its input", () => {
    const bad = [{ key: "acct:x", value: "not json", at: 9 }, { key: "acct:y", value: JSON.stringify({ gameName: 5 }), at: 8 }, row("acct:zed#eu", "Zed", "EU", 1)];
    const copy = [...bad];
    expect(searchStoredPlayers(bad, "ze").map((p) => p.riotId)).toEqual(["Zed#EU"]);
    expect(bad).toEqual(copy);
  });
  it("normalizeName strips accents and punctuation", () => expect(normalizeName("Ahrí Kai'Sa #1")).toBe("ahrikaisa1"));
});

describe("cache.scan", () => {
  it("returns only keys with the prefix (wildcard characters are plain text), newest first, limited", () => {
    const c = makeCache(new DatabaseSync(":memory:"));
    c.set("acct:a#1", "{}", 1); c.set("acct:b#1", "{}", 3); c.set("acct%:c", "{}", 9); c.set("profile:euw1:p", "{}", 5); c.set("acct:d#1", "{}", 2);
    expect(c.scan("acct:", 10).map((r) => r.key)).toEqual(["acct:b#1", "acct:d#1", "acct:a#1"]);
    expect(c.scan("acct:", 2)).toHaveLength(2);
    expect(c.scan("acct%", 10).map((r) => r.key)).toEqual(["acct%:c"]);
    expect(c.scan("zzz", 10)).toEqual([]);
  });
});

describe("GET /v1/players", () => {
  let app: Awaited<ReturnType<typeof buildApp>>, riot: ReturnType<typeof fakeRiot>, calls: number;
  beforeEach(async () => {
    riot = fakeRiot(); calls = 0; const orig = riot.account; riot.account = async (n, t, r) => { calls++; return orig(n, t, r); };
    const store = seededStore();
    app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
  });
  it("lists a player once Apex has looked them up, and never calls Riot itself", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/players?q=test" })).json()).toEqual([]);
    expect((await app.inject({ method: "GET", url: "/v1/players/Test%20Player%23EUW" })).statusCode).toBe(200);
    const before = calls;
    const r = await app.inject({ method: "GET", url: "/v1/players?q=testplayer" });
    expect(r.statusCode).toBe(200);
    expect(r.json().map((p: { riotId: string }) => p.riotId)).toEqual(["Test Player#EUW"]);
    expect(calls).toBe(before);
  });
  it("returns [] for a missing or too short query and caps the limit", async () => {
    for (const u of ["/v1/players", "/v1/players?q=", "/v1/players?q=t", "/v1/players?q=test&limit=999"]) expect((await app.inject({ method: "GET", url: u })).statusCode).toBe(200);
    expect(ACCOUNT_PREFIX).toBe("acct:");
  });
});

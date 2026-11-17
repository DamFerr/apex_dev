import { describe, expect, it } from "vitest";
import { itemWpa, type WpaStratum } from "./wpa";

const st = (oG: number, oW: number, xG: number, xW: number): WpaStratum => ({ owners: { games: oG, wins: oW }, others: { games: xG, wins: xW } });

describe("itemWpa", () => {
  it("is exactly 0 with no owners", () => expect(itemWpa([st(0, 0, 100, 50)])).toMatchObject({ games: 0, wpa: 0, lo: 0, hi: 0 }));
  it("is 0 when owners win as often as non-owners in every stratum", () => {
    const r = itemWpa([st(200, 100, 200, 100), st(100, 70, 300, 210)]);
    expect(Math.abs(r.wpa)).toBeLessThan(0.1); expect(r.lo).toBeLessThan(0); expect(r.hi).toBeGreaterThan(0);
  });
  it("is positive, shrunk, and its range excludes 0 for a big real edge", () => {
    const r = itemWpa([st(1000, 600, 1000, 500)]);                     // owners 60%, others 50%
    expect(r.wpa).toBeGreaterThan(8); expect(r.wpa).toBeLessThan(10);   // 10 pp raw, shrunk by 1000/1050
    expect(r.lo).toBeGreaterThan(0); expect(r.hi).toBeGreaterThan(r.wpa);
  });
  it("is negative for an item that goes with losing", () => expect(itemWpa([st(500, 200, 500, 250)]).wpa).toBeLessThan(-5));
  it("cannot make a tiny sample look big: 3 wins in 3 games against a 50% baseline is only about +2.8 pp", () => {
    const r = itemWpa([st(3, 3, 1000, 500)]);
    expect(r.wpa).toBeGreaterThan(2); expect(r.wpa).toBeLessThan(3.2); expect(r.lo).toBeLessThan(0);
  });
  it("removes the game-length bias (Simpson): an item owned mostly in long games that everyone wins is worth ~0", () => {
    // long games: 80% win for everyone; short games: 30% win for everyone. Owners are mostly in long games.
    const strata = [st(900, 720, 100, 80), st(100, 30, 900, 270)];
    const raw = (720 + 30) / 1000 - (80 + 270) / 1000;                  // naive owners-vs-others gap: +40 pp
    expect(raw).toBeGreaterThan(0.35);
    expect(Math.abs(itemWpa(strata).wpa)).toBeLessThan(1);
  });
  it("falls back to the stratum average when a stratum has almost no non-owners", () => {
    const r = itemWpa([st(400, 240, 2, 0)]);                            // 60% owners, 2 non-owners who lost: baseline stays near 60%, not 0%
    expect(r.expected).toBeGreaterThan(0.5); expect(Math.abs(r.wpa)).toBeLessThan(4);   // not the naive +60 pp
  });
  it("reports the owners' games and wins", () => expect(itemWpa([st(10, 6, 20, 10), st(5, 1, 5, 2)])).toMatchObject({ games: 15, wins: 7 }));
});

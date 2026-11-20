import { describe, expect, it } from "vitest";
import type { PoolEntry } from "@apex/schema";
import { poolInsight } from "./poolInsight";

const e = (champion: string, games: number, wins = 0, points = 0): PoolEntry => ({ champion, games, wins, points });

describe("poolInsight", () => {
  it("returns null under 10 recent games", () => {
    expect(poolInsight([e("Ahri", 5), e("Zed", 4)])).toBeNull();
    expect(poolInsight([])).toBeNull();
  });
  it("calls a pool focused when the top 3 take 70%+ of the games", () => {
    const p = poolInsight([e("Ahri", 8), e("Zed", 5), e("Lux", 3), e("Vex", 2), e("Syndra", 2)])!;
    expect([p.games, p.champions, p.shape]).toEqual([20, 5, "focused"]);
    expect(p.topShare).toBeCloseTo(0.8);
  });
  it("calls a pool wide at 45% or less and balanced in between", () => {
    const wide = poolInsight(Array.from({ length: 10 }, (_, i) => e(`C${i}`, 2)))!;
    expect(wide.shape).toBe("wide");
    const mid = poolInsight([e("A", 5), e("B", 4), e("C", 3), e("D", 3), e("E", 3), e("F", 2)])!;
    expect(mid.shape).toBe("balanced");
  });
  it("flags a one-trick only with 6+ games and 50%+ of the games", () => {
    expect(poolInsight([e("Yasuo", 10, 6), e("Zed", 6), e("Lux", 4)])!.oneTrick?.champion).toBe("Yasuo");
    expect(poolInsight([e("Yasuo", 5), e("Zed", 5), e("Lux", 5), e("Ahri", 5)])!.oneTrick).toBeNull();
    expect(poolInsight([e("Yasuo", 8), e("Zed", 6), e("Lux", 6)])!.oneTrick).toBeNull();
  });
  it("lists high-mastery champions without a recent game as dusty, most points first", () => {
    const p = poolInsight([e("Ahri", 10), e("Zed", 10), e("Teemo", 0, 0, 90000), e("Lux", 0, 0, 150000), e("Vex", 0, 0, 5000), e("Jinx", 2, 1, 300000)])!;
    expect(p.dusty.map((d) => d.champion)).toEqual(["Lux", "Teemo"]);
  });
});

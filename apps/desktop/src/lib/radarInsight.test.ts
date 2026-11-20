import { describe, expect, it } from "vitest";
import type { PlayerRadar, PlayerRadarAxis } from "@apex/schema";
import { radarInsights } from "./radarInsight";

const ax = (id: PlayerRadarAxis["id"], value: number, reference: number, score: number): PlayerRadarAxis => ({ id, value, reference, score, letter: "B" });
const radar = (over: Partial<PlayerRadar> = {}): PlayerRadar => ({
  role: "MID", games: 30, low: false, overall: 52, best: "farming", worst: "fighting",
  axes: [ax("fighting", 2, 2.5, 38), ax("farming", 8.4, 7.5, 66), ax("damage", 700, 700, 50)],
  reference: { label: "Gold", games: 400, tier: "GOLD" }, ...over,
});

describe("radarInsights", () => {
  it("returns the best axis as a strength and the worst as a weakness with the % difference", () => {
    const [s, w] = radarInsights(radar());
    expect([s.kind, s.axis.id, s.diffPct]).toEqual(["strength", "farming", 12]);
    expect([w.kind, w.axis.id, w.diffPct]).toEqual(["weakness", "fighting", -20]);
  });
  it("shows nothing under LOW DATA, without a reference, or under 3 axes", () => {
    expect(radarInsights(radar({ low: true }))).toEqual([]);
    expect(radarInsights(radar({ reference: null }))).toEqual([]);
    expect(radarInsights(radar({ axes: radar().axes.slice(0, 2) }))).toEqual([]);
  });
  it("does not call an axis within 5 points of the average a strength or weakness", () => {
    const r = radar({ axes: [ax("fighting", 2.4, 2.5, 47), ax("farming", 7.7, 7.5, 53), ax("damage", 700, 700, 50)] });
    expect(radarInsights(r)).toEqual([]);
  });
  it("keeps one side when only that side is clear", () => {
    const r = radar({ axes: [ax("fighting", 2.4, 2.5, 47), ax("farming", 8.4, 7.5, 66), ax("damage", 700, 700, 50)] });
    expect(radarInsights(r).map((i) => i.kind)).toEqual(["strength"]);
  });
  it("has no % difference when the average is 0", () => {
    const r = radar({ axes: [ax("fighting", 2, 2.5, 38), ax("farming", 8.4, 0, 66), ax("damage", 700, 700, 50)] });
    expect(radarInsights(r)[0].diffPct).toBeNull();
  });
  it("ignores best/worst ids that are not among the axes", () => {
    expect(radarInsights(radar({ best: null, worst: null }))).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { MIN_RADAR_GAMES, radarValues, skillRadar, type RadarGame, type RadarReference } from "./radar";

const game = (o: Partial<RadarGame> = {}): RadarGame => ({ kills: 5, deaths: 5, assists: 5, cs: 200, damage: 20000, gold: 12000, vision: 20, minutes: 30, ...o });
const ref: RadarReference = { fighting: 2, farming: 200 / 30, damage: 20000 / 30, economy: 12000 / 30, vision: 20 / 30 };
const games = (n: number, o: Partial<RadarGame> = {}) => Array.from({ length: n }, () => game(o));

describe("radarValues", () => {
  it("is null without usable games", () => {
    expect(radarValues([])).toBeNull();
    expect(radarValues([game({ minutes: 0 }), game({ cs: NaN }), game({ kills: -1 })])).toBeNull();
  });
  it("uses totals over totals, so a short game cannot outweigh a long one", () => {
    const v = radarValues([game({ cs: 300, minutes: 40 }), game({ cs: 10, minutes: 5 })])!;
    expect(v.farming).toBeCloseTo(310 / 45, 6);
  });
  it("keeps KDA finite with no deaths", () => {
    expect(radarValues([game({ kills: 6, assists: 4, deaths: 0 })])!.fighting).toBe(10);
  });
});

describe("skillRadar", () => {
  it("scores exactly 50 (B) on every axis when equal to the reference", () => {
    const r = skillRadar(games(12), ref);
    expect(r.axes).toHaveLength(5);
    for (const a of r.axes) { expect(a.score).toBe(50); expect(a.letter).toBe("B"); }
    expect(r.overall).toBe(50);
    expect(r.best).toBeNull(); expect(r.worst).toBeNull(); // all equal: no best or worst
    expect(r.low).toBe(false);
  });
  it("scores a 1.5x axis about 88 and finds best and worst", () => {
    const r = skillRadar(games(12, { cs: 300 }), ref); // 1.5x the CS reference, rest equal
    const farming = r.axes.find((a) => a.id === "farming")!;
    expect(farming.score).toBe(88); expect(farming.letter).toBe("S");
    expect(r.best).toBe("farming");
    expect(r.worst).not.toBe("farming");
    expect(r.overall).toBe(58);
  });
  it("flags LOW DATA under the minimum number of games and counts only usable games", () => {
    expect(skillRadar(games(MIN_RADAR_GAMES - 1), ref).low).toBe(true);
    expect(skillRadar(games(MIN_RADAR_GAMES), ref).low).toBe(false);
    expect(skillRadar([...games(3), game({ minutes: 0 })], ref).games).toBe(3);
  });
  it("skips axes without a usable reference and gives no overall below 3 axes", () => {
    const partial = skillRadar(games(12), { ...ref, vision: null, damage: 0, economy: null });
    expect(partial.axes.map((a) => a.id)).toEqual(["fighting", "farming"]);
    expect(partial.overall).toBeNull();
    const three = skillRadar(games(12), { ...ref, vision: null, damage: null });
    expect(three.overall).toBe(50);
  });
  it("returns an empty radar for no games", () => {
    expect(skillRadar([], ref)).toMatchObject({ games: 0, low: true, axes: [], overall: null, best: null, worst: null });
  });
});

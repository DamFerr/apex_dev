import { describe, expect, it } from "vitest";
import { initialDraft, needsPickResume, pickFromGameflowSession, type DraftState, type GameflowSession } from "./index";

const session: GameflowSession = { gameData: {
  teamOne: [{ summonerId: 1, puuid: "a", championId: 22, selectedPosition: "BOTTOM" }, { summonerId: 2, puuid: "b", championId: 103, selectedPosition: "MIDDLE" }],
  teamTwo: [{ summonerId: 3, puuid: "c", championId: 7, selectedPosition: "MIDDLE" }],
} };
const at = (gameflow: string, over: Partial<DraftState> = {}): DraftState => ({ ...initialDraft, connected: true, gameflow, ...over });

describe("pickFromGameflowSession", () => {
  it("finds your champion and role by summoner id", () => expect(pickFromGameflowSession(session, { summonerId: 2 })).toEqual({ championId: 103, role: "MID" }));
  it("finds it by puuid, on either team", () => expect(pickFromGameflowSession(session, { puuid: "c" })).toEqual({ championId: 7, role: "MID" }));
  it("maps every position name the client uses", () => {
    const s: GameflowSession = { gameData: { teamOne: [{ summonerId: 9, championId: 1, selectedPosition: "UTILITY" }] } };
    expect(pickFromGameflowSession(s, { summonerId: 9 })?.role).toBe("SUPPORT");
  });
  it("gives a null role when no position is set (ARAM, custom)", () => expect(pickFromGameflowSession({ gameData: { teamOne: [{ summonerId: 9, championId: 5 }] } }, { summonerId: 9 })).toEqual({ championId: 5, role: null }));
  it("returns null when you are not listed, the champion is 0, or nothing is known", () => {
    expect(pickFromGameflowSession(session, { summonerId: 99 })).toBeNull();
    expect(pickFromGameflowSession({ gameData: { teamOne: [{ summonerId: 9, championId: 0 }] } }, { summonerId: 9 })).toBeNull();
    expect(pickFromGameflowSession(null, { summonerId: 1 })).toBeNull();
    expect(pickFromGameflowSession({}, { summonerId: 1 })).toBeNull();
    expect(pickFromGameflowSession(session, null)).toBeNull();
    expect(pickFromGameflowSession(session, {})).toBeNull();
  });
});

describe("needsPickResume", () => {
  const pick = { championId: 1, role: null };
  it("is true when connected in loading screen or game without a remembered pick", () => { for (const p of ["GameStart", "InProgress", "Reconnect"]) expect(needsPickResume(null, at(p))).toBe(true); });
  it("is false with a pick, outside a game, or when disconnected", () => {
    expect(needsPickResume(pick, at("InProgress"))).toBe(false);
    for (const p of ["None", "Lobby", "ChampSelect", "EndOfGame"]) expect(needsPickResume(null, at(p))).toBe(false);
    expect(needsPickResume(null, at("InProgress", { connected: false }))).toBe(false);
  });
});

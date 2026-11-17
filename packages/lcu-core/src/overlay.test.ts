import { describe, expect, it } from "vitest";
import { initialDraft, isInGame, nextPick, overlayWanted, reduce, type DraftState, type OverlayPick } from "./index";

const pick: OverlayPick = { championId: 103, role: "MID" };
const locked: DraftState = { ...initialDraft, connected: true, gameflow: "ChampSelect", active: true, localLocked: { championId: 103, role: "MID" } };
const at = (gameflow: string, over: Partial<DraftState> = {}): DraftState => ({ ...initialDraft, connected: true, gameflow, ...over });

describe("nextPick", () => {
  it("remembers the lock-in", () => expect(nextPick(null, locked)).toEqual(pick));
  it("follows a changed lock-in", () => expect(nextPick(pick, { ...locked, localLocked: { championId: 7, role: "MID" } })?.championId).toBe(7));
  it("survives the draft reset when champ select ends, through loading screen and game", () => {
    // The real reducer wipes localLocked on every gameflow change after champ select, which is exactly why the pick is remembered separately.
    let draft = locked, memory: OverlayPick | null = null;
    memory = nextPick(memory, draft);
    for (const phase of ["GameStart", "InProgress", "Reconnect", "InProgress"]) { draft = reduce(draft, { type: "gameflow", phase }); expect(draft.localLocked).toBeNull(); memory = nextPick(memory, draft); expect(memory).toEqual(pick); }
  });
  it("forgets the pick when the game is over, in the lobby, or when the client closes", () => {
    for (const phase of ["WaitingForStats", "PreEndOfGame", "EndOfGame", "None", "Lobby", "Matchmaking", "ReadyCheck"]) expect(nextPick(pick, at(phase))).toBeNull();
    expect(nextPick(pick, reduce(at("InProgress"), { type: "disconnected" }))).toBeNull();
  });
  it("forgets it when a new champ select starts without a lock (a dodge, or the next game)", () => expect(nextPick(pick, at("ChampSelect", { active: true }))).toBeNull());
});

describe("overlayWanted", () => {
  const base = { enabled: true, preview: false, phase: "InProgress", pick };
  it("shows during a game when enabled and a pick is known", () => { expect(overlayWanted(base)).toBe(true); expect(overlayWanted({ ...base, phase: "Reconnect" })).toBe(true); });
  it("is off by default and never shows when disabled", () => expect(overlayWanted({ ...base, enabled: false })).toBe(false));
  it("never shows outside a game, so it cannot cover the client", () => { for (const phase of ["None", "Lobby", "ChampSelect", "GameStart", "EndOfGame"]) expect(overlayWanted({ ...base, phase })).toBe(false); });
  it("stays hidden without a pick", () => expect(overlayWanted({ ...base, pick: null })).toBe(false));
  it("previewing from Settings shows it regardless", () => expect(overlayWanted({ ...base, enabled: false, preview: true, phase: "None", pick: null })).toBe(true));
  it("isInGame is only the running game", () => expect(["InProgress", "Reconnect", "GameStart", "ChampSelect"].map(isInGame)).toEqual([true, true, false, false]));
});

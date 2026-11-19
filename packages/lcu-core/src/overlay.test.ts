import { describe, expect, it } from "vitest";
import { clampOverlayPosition, initialDraft, isInGame, nextPick, overlayWanted, reduce, startItemsLeftMs, START_ITEMS_MS, type MonitorInfo, type DraftState, type OverlayPick } from "./index";

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

const mon = (o: Partial<MonitorInfo> = {}): MonitorInfo => ({ id: "A", x: 0, y: 0, width: 1920, height: 1080, scale: 1, primary: true, ...o });
const card = { width: 340, height: 340 };
describe("clampOverlayPosition", () => {
  it("keeps a saved spot that is already on screen", () => expect(clampOverlayPosition({ monitorId: "A", x: 100, y: 200 }, [mon()], card)).toEqual({ monitorId: "A", x: 100, y: 200, fellBack: false }));
  it("pulls a spot back inside the monitor on every side", () => {
    expect(clampOverlayPosition({ monitorId: "A", x: -50, y: -9 }, [mon()], card)).toMatchObject({ x: 0, y: 0 });
    expect(clampOverlayPosition({ monitorId: "A", x: 5000, y: 5000 }, [mon()], card)).toMatchObject({ x: 1580, y: 740 });
  });
  it("uses the scale factor: logical offsets become physical pixels, and the limit is in logical pixels", () => {
    const m = mon({ width: 3840, height: 2160, scale: 2 });                     // 1920x1080 logical
    expect(clampOverlayPosition({ monitorId: "A", x: 100, y: 50 }, [m], card)).toMatchObject({ x: 200, y: 100 });
    expect(clampOverlayPosition({ monitorId: "A", x: 9999, y: 9999 }, [m], card)).toMatchObject({ x: 3160, y: 1480 });
  });
  it("adds the monitor origin, also a negative one (a monitor left of the primary)", () =>
    expect(clampOverlayPosition({ monitorId: "L", x: 10, y: 20 }, [mon(), mon({ id: "L", x: -1920, primary: false })], card)).toMatchObject({ monitorId: "L", x: -1910, y: 20, fellBack: false }));
  it("falls back to the top-left of the primary monitor when the saved monitor is gone", () =>
    expect(clampOverlayPosition({ monitorId: "gone", x: 10, y: 20 }, [mon({ id: "B", x: 1920, primary: false }), mon()], card)).toEqual({ monitorId: "A", x: 24, y: 120, fellBack: true }));
  it("falls back with nothing saved, and to the first monitor if none is primary", () => {
    expect(clampOverlayPosition(null, [mon()], card)).toMatchObject({ x: 24, y: 120, fellBack: true });
    expect(clampOverlayPosition(null, [mon({ id: "Z", primary: false })], card)?.monitorId).toBe("Z");
  });
  it("treats unusable saved numbers and broken monitors as missing", () => {
    expect(clampOverlayPosition({ monitorId: "A", x: NaN, y: 5 }, [mon()], card)?.fellBack).toBe(true);
    expect(clampOverlayPosition({ monitorId: "A", x: 5, y: 5 }, [mon({ scale: 0 })], card)).toBeNull();
  });
  it("returns null without monitors, and pins a card bigger than the monitor to its top-left", () => {
    expect(clampOverlayPosition(null, [], card)).toBeNull();
    expect(clampOverlayPosition({ monitorId: "A", x: 50, y: 50 }, [mon({ width: 300, height: 300 })], card)).toMatchObject({ x: 0, y: 0 });
  });
});
describe("startItemsLeftMs", () => {
  it("is the full time before the overlay has been shown", () => expect(startItemsLeftMs(null, 1e6)).toBe(START_ITEMS_MS));
  it("counts down from when it appeared and stops at 0", () => {
    expect(START_ITEMS_MS).toBe(45_000);
    expect(startItemsLeftMs(1000, 11_000)).toBe(START_ITEMS_MS - 10_000);
    expect(startItemsLeftMs(1000, 1000 + START_ITEMS_MS)).toBe(0);
    expect(startItemsLeftMs(1000, 999_999)).toBe(0);
  });
  it("never exceeds the full time (clock moved back)", () => expect(startItemsLeftMs(5000, 1000)).toBe(START_ITEMS_MS));
});

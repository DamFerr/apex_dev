import { describe, expect, it } from "vitest";
import { cleanOverlayPositions, migrateUi, savedOverlayPlacement } from "./store";

describe("cleanOverlayPositions", () => {
  it("keeps good entries (rounded) and drops broken ones", () =>
    expect(cleanOverlayPositions({ A: { x: 10.4, y: 20 }, B: { x: NaN, y: 1 }, C: { x: "1", y: 2 }, D: null, E: 5 })).toEqual({ A: { x: 10, y: 20 } }));
  it("survives anything that is not an object", () => { for (const v of [null, undefined, 3, "x", []]) expect(cleanOverlayPositions(v)).toEqual({}); });
});
describe("savedOverlayPlacement", () => {
  const positions = { A: { x: 5, y: 6 } };
  it("is the last used monitor's spot", () => expect(savedOverlayPlacement({ overlayMonitor: "A", overlayPositions: positions })).toEqual({ monitorId: "A", x: 5, y: 6 }));
  it("is null without a monitor or without a spot for it (corner preset applies)", () => {
    expect(savedOverlayPlacement({ overlayMonitor: null, overlayPositions: positions })).toBeNull();
    expect(savedOverlayPlacement({ overlayMonitor: "B", overlayPositions: positions })).toBeNull();
  });
});
describe("migrateUi", () => {
  it("version 1 -> 2 keeps the overlay settings and adds an empty position", () => {
    const s = migrateUi({ overlayEnabled: true, overlayOpacity: 0.7, overlayCorner: "top-right", myRiotId: "A#EUW", hotkeys: { compactToggle: "X" } }, 1) as unknown as Record<string, unknown>;
    expect(s).toMatchObject({ overlayEnabled: true, overlayOpacity: 0.7, overlayCorner: "top-right", myRiotId: "A#EUW", overlayPositions: {}, overlayMonitor: null });
  });
  it("version 0 -> 2 still removes the old settings and the demo Riot ID", () => {
    const s = migrateUi({ overlayEnabled: true, language: "en", dataSource: "sample", myRiotId: "Demo Player#EUW", hotkeys: { overlayToggle: "Y", compactToggle: "X" } }, 0) as unknown as Record<string, unknown>;
    expect(s).toMatchObject({ myRiotId: "", hotkeys: { compactToggle: "X" }, overlayPositions: {}, overlayMonitor: null });
    for (const k of ["overlayEnabled", "language", "dataSource"]) expect(s).not.toHaveProperty(k);
  });
  it("repairs a stored position: bad entries go, a monitor without a spot is cleared", () => {
    const s = migrateUi({ overlayPositions: { A: { x: 1, y: 2 }, B: { x: "no", y: 2 } }, overlayMonitor: "B" }, 2) as unknown as Record<string, unknown>;
    expect(s).toMatchObject({ overlayPositions: { A: { x: 1, y: 2 } }, overlayMonitor: null });
  });
  it("keeps a valid saved spot", () => expect(migrateUi({ overlayPositions: { A: { x: 1, y: 2 } }, overlayMonitor: "A" }, 2)).toMatchObject({ overlayMonitor: "A" }));
});

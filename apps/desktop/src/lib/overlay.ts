import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import type { ChampionBuild, Role } from "@apex/schema";
import { clampOverlayPosition, overlayWanted, type MonitorInfo } from "@apex/lcu-core";
import { fetchBuild } from "./importer";
import { champId, champName, useDraft } from "./lcu";
import { savedOverlayPlacement, useUi, type Theme } from "./store";
import { isTauri } from "./tauri";

/** Everything the overlay window shows. The overlay is a separate window with its own JavaScript, so the main window sends it this over Tauri events. */
export interface OverlayPayload {
  champion: string; championName: string; role: Role | null; build: ChampionBuild | null;
  opacity: number; theme: Theme; reduceMotion: boolean;
  /** When the overlay window last appeared (ms since epoch), null while hidden. The card hides its start items a fixed time after this (a plain timer, no game state). */
  shownAt: number | null;
}
export const OVERLAY_STATE = "overlay-state", OVERLAY_READY = "overlay-ready";
/** Sent by the overlay window after a drag: where the card was dropped (monitor id + logical px from its top-left). The main window saves it. */
export const OVERLAY_MOVED = "overlay-moved";
export interface OverlayMoved { monitorId: string; x: number; y: number }
/** Size of the overlay window in logical pixels (same as WIDTH / HEIGHT in `overlay.rs`): the rectangle that is clamped onto a monitor. */
export const OVERLAY_WINDOW = { width: 340, height: 340 };
/** What the Rust command `overlay_layout` returns: monitors and the overlay window, all in physical pixels. */
export interface OverlayLayout { monitors: MonitorInfo[]; window: { x: number; y: number; width: number; height: number } }

/** A manual preview from Settings (not saved): shows the overlay regardless of the game phase, to check position and opacity. */
export const useOverlayPreview = create<{ preview: boolean; set: (v: boolean) => void }>((set) => ({ preview: false, set: (preview) => set({ preview }) }));

/**
 * Runs in the main window. Fetches the build of the champion you locked, sends it (with the look settings) to the overlay window,
 * and shows or hides that window: on only while a game is running and only when you enabled it (see `overlayWanted`).
 * It only ever uses what is known at champ select (your locked champion and collected statistics), never game state.
 */
export function useOverlayController() {
  const pick = useDraft((s) => s.overlayPick), phase = useDraft((s) => s.draft.gameflow), preview = useOverlayPreview((s) => s.preview);
  const enabled = useUi((s) => s.overlayEnabled), opacity = useUi((s) => s.overlayOpacity), corner = useUi((s) => s.overlayCorner), theme = useUi((s) => s.theme), reduceMotion = useUi((s) => s.reduceMotion);
  const [build, setBuild] = useState<{ key: number; build: ChampionBuild | null } | null>(null);
  const visible = overlayWanted({ enabled, preview, phase, pick });
  const [shownAt, setShownAt] = useState<number | null>(null);
  useEffect(() => { setShownAt(visible ? Date.now() : null); }, [visible]);   // starts the start-items timer when the overlay appears

  // The build is fetched once per locked champion, long before the game starts.
  const key = pick?.championId ?? null, role = pick?.role ?? null;
  useEffect(() => {
    if (!isTauri || key === null) { setBuild(null); return; }
    let stale = false;
    void fetchBuild(key, role).then((b) => { if (!stale) setBuild({ key, build: b }); }).catch(() => { if (!stale) setBuild({ key, build: null }); });
    return () => { stale = true; };
  }, [key, role]);

  const payload = useMemo<OverlayPayload | null>(() => {
    const id = key === null ? undefined : champId(key);
    return key !== null && id ? { champion: id, championName: champName(key), role, build: build?.key === key ? build.build : null, opacity, theme, reduceMotion, shownAt } : null;
  }, [key, role, build, opacity, theme, reduceMotion, shownAt]);

  // Keep the newest payload for a window that opens later: it announces itself and gets the current one.
  const latest = useRef<OverlayPayload | null>(null);
  useEffect(() => {
    latest.current = payload;
    if (isTauri) void emit(OVERLAY_STATE, payload).catch(() => undefined);
  }, [payload]);
  useEffect(() => {
    if (!isTauri) return;
    let off: (() => void) | undefined, dead = false;
    void listen(OVERLAY_READY, () => void emit(OVERLAY_STATE, latest.current)).then((f) => { if (dead) f(); else off = f; });
    return () => { dead = true; off?.(); };
  }, []);

  // A dragged-to spot is saved when the overlay window reports it (the store, and so the saved position, lives in this window).
  useEffect(() => {
    if (!isTauri) return;
    let off: (() => void) | undefined, dead = false;
    void listen<OverlayMoved>(OVERLAY_MOVED, (e) => useUi.getState().setOverlayPosition(e.payload.monitorId, { x: e.payload.x, y: e.payload.y })).then((f) => { if (dead) f(); else off = f; });
    return () => { dead = true; off?.(); };
  }, []);

  // Where the window goes: the saved free position if there is one (re-clamped onto the monitors that exist NOW), else the corner preset.
  // `hasSpot` (not the numbers) is the dependency: a drag already put the window there, and "Reset position" flips it back to the corner.
  const hasSpot = useUi((s) => s.overlayMonitor !== null);
  useEffect(() => {
    if (!isTauri) return;
    let stale = false;
    void (async () => {
      let spot: { x: number; y: number } | null = null;
      const saved = visible ? savedOverlayPlacement(useUi.getState()) : null;
      if (saved) {
        // Monitors can only be listed through the overlay window, which exists once it has been shown once; the first show uses the corner and moves right after.
        await invoke("set_overlay", { visible, corner, preview }).catch(() => undefined);
        const l = await invoke<OverlayLayout>("overlay_layout").catch(() => null);
        const c = l && clampOverlayPosition(saved, l.monitors, OVERLAY_WINDOW);
        if (c && !c.fellBack) spot = { x: c.x, y: c.y };
        if (stale) return;
      }
      await invoke("set_overlay", { visible, corner, x: spot?.x ?? null, y: spot?.y ?? null, preview }).catch((e) => console.warn("overlay:", e));
    })();
    return () => { stale = true; };
  }, [visible, corner, hasSpot, preview]);
}

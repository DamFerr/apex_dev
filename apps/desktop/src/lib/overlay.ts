import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import type { ChampionBuild, Role } from "@apex/schema";
import { overlayWanted } from "@apex/lcu-core";
import { fetchBuild } from "./importer";
import { champId, champName, useDraft } from "./lcu";
import { useUi, type Theme } from "./store";
import { isTauri } from "./tauri";

/** Everything the overlay window shows. The overlay is a separate window with its own JavaScript, so the main window sends it this over Tauri events. */
export interface OverlayPayload {
  champion: string; championName: string; role: Role | null; build: ChampionBuild | null;
  opacity: number; theme: Theme; reduceMotion: boolean;
  /** When the overlay window last appeared (ms since epoch), null while hidden. The card hides its start items a fixed time after this (a plain timer, no game state). */
  shownAt: number | null;
}
export const OVERLAY_STATE = "overlay-state", OVERLAY_READY = "overlay-ready";

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

  useEffect(() => {
    if (isTauri) void invoke("set_overlay", { visible, corner }).catch((e) => console.warn("overlay:", e));
  }, [visible, corner]);
}

import type { Role } from "@apex/schema";
import type { DraftState } from "./draft";
import type { GameflowPhase } from "./types";

/** The champion the local player locked in champ select, remembered so the overlay still knows it once the game has started. */
export interface OverlayPick { championId: number; role: Role | null }

/** Phases in which a game is running (the loading screen is GameStart, which is not "in game" yet). */
const IN_GAME: GameflowPhase[] = ["InProgress", "Reconnect"];
export const isInGame = (phase: GameflowPhase) => IN_GAME.includes(phase);
/** Phases between the lock-in and the end of the game: the pick must survive these, because the draft state is reset when champ select ends. */
const KEEP: GameflowPhase[] = ["GameStart", ...IN_GAME];

/**
 * The pick the overlay should show after `next`. A lock-in sets it; the phases from loading screen to game keep it; anything else
 * (a new champ select without a lock, a dodge, the lobby, end of game, the client closing) clears it, so a stale champion never shows in the next game.
 */
export function nextPick(memory: OverlayPick | null, next: DraftState): OverlayPick | null {
  if (next.localLocked) return { championId: next.localLocked.championId, role: next.localLocked.role };
  return next.connected && KEEP.includes(next.gameflow) ? memory : null;
}

/**
 * Should the overlay window be on screen? Only when the player turned it on and a game is running (so it never covers the client),
 * or while previewing from Settings. Without a remembered pick the overlay has nothing to show, so it stays hidden unless previewing.
 */
export function overlayWanted(o: { enabled: boolean; preview: boolean; phase: GameflowPhase; pick: OverlayPick | null }): boolean {
  return o.preview || (o.enabled && isInGame(o.phase) && o.pick !== null);
}

/** One monitor as the OS reports it: position and size in physical pixels, plus its scale factor (1.5 = 150 % Windows scaling). */
export interface MonitorInfo { id: string; x: number; y: number; width: number; height: number; scale: number; primary: boolean }
/** A saved overlay position: which monitor, and the card's top-left in LOGICAL pixels from that monitor's top-left (so it survives a scale or resolution change). */
export interface OverlayPlacement { monitorId: string; x: number; y: number }
/** Gap to the screen edge and the extra drop for top positions (below the game's own top bar), in logical pixels. Same values as `overlay.rs`. */
export const OVERLAY_MARGIN = 24, OVERLAY_TOP_OFFSET = 120;

/**
 * Where the overlay window goes, as absolute PHYSICAL pixels (what Tauri's `PhysicalPosition` takes), always fully on a monitor.
 * The saved spot is clamped into its own monitor, using that monitor's scale factor. If the monitor is gone (unplugged, new layout)
 * or the saved numbers are unusable, it falls back to the top-left of the primary monitor (or the first one if none is flagged primary).
 * Returns null only when there are no monitors at all. `size` is the card's logical size.
 */
export function clampOverlayPosition(saved: OverlayPlacement | null, monitors: MonitorInfo[], size: { width: number; height: number }): { monitorId: string; x: number; y: number; fellBack: boolean } | null {
  const usable = monitors.filter((m) => m.scale > 0 && m.width > 0 && m.height > 0);
  const own = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? usable.find((m) => m.id === saved.monitorId) : undefined;
  const m = own ?? usable.find((x) => x.primary) ?? usable[0];
  if (!m) return null;
  const lw = m.width / m.scale, lh = m.height / m.scale;               // monitor size in logical pixels
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(max, 0)); // a monitor smaller than the card pins it to the top-left edge
  const lx = own ? clamp(saved!.x, lw - size.width) : clamp(OVERLAY_MARGIN, lw - size.width);
  const ly = own ? clamp(saved!.y, lh - size.height) : clamp(OVERLAY_TOP_OFFSET, lh - size.height);
  return { monitorId: m.id, x: Math.round(m.x + lx * m.scale), y: Math.round(m.y + ly * m.scale), fellBack: !own };
}

/** How long the starting items stay on the overlay card after the game starts (they are bought in the first seconds, then they are just noise). */
export const START_ITEMS_MS = 45_000;
/**
 * Milliseconds the start-items row should still be shown. A plain timer from the moment the overlay appeared: it reads NO game state
 * (not your inventory, gold or the game clock), so it cannot know what you bought. `shownAt` null = not shown yet = full time left.
 */
export const startItemsLeftMs = (shownAt: number | null, now: number, ttl = START_ITEMS_MS) => shownAt === null ? ttl : Math.max(0, Math.min(ttl, shownAt + ttl - now));

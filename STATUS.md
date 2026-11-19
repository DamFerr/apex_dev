# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: overlay drag v3 (hover-interactive, no hook).** Owner: alt-tab hide works, drag still dead in game (hook and `GetAsyncKeyState` are blind while the game is in front; cursor position and foreground class still work). `overlay.rs` `hook` module (Windows): the 8 ms `mover` loop reads only `GetCursorPos`; cursor over the card (rect from `overlay_card`) = `WS_EX_TRANSPARENT` cleared so the window gets real mouse input, else click-through. `Overlay.tsx` `useCardDrag`: left `pointerdown` on the card -> `setPointerCapture` + `overlay_drag_begin` (Rust stores grab offset, window follows the cursor); `pointerup`/`pointercancel`/`lostpointercapture` -> `overlay_drag_end` -> Rust emits `overlay-drag-end` -> page clamps/saves as before. Mouse hook, key-state poll, `windows-sys` features `LibraryLoader`/`KeyboardAndMouse` removed. Game-only visibility (foreground class `RiotWindowClass`, `preview` flag) kept. `docs/COMPLIANCE.md` reworded to match (D.6 text).
- Verified: desktop typecheck + 55/55. NOT verified: Rust (never compiled here; `GetWindowLongPtrW`/`SetWindowLongPtrW`/`GWL_EXSTYLE`/`WS_EX_TRANSPARENT` from memory, x64 only), real dragging in game, e2e.
- Known limits: clamp uses the whole 340x340 window; first show with a saved spot appears at the corner for one frame; right/middle clicks on the card (not outside it) go to the card, not the game; exclusive-fullscreen games may still hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing or drag/hide still wrong in game, fix that first (ask for the compile error or the foreground window class via a debug print). Then **D.7** (`grep -n "D\.7" PLAN.md`): the 45 s timer counts from the loading screen; needs a measured loading-screen length or the game clock (P3, policy check first).

## Files to Read Next
1. `PLAN.md` D.7 line only, and `apps/desktop/src/lib/overlay.ts` (`startItemsLeftMs`).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

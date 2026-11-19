# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: overlay mouse fix + D.5.** Owner: the card must act like part of the game: only a LEFT-button drag moves it; right clicks, hover and clicks under it go to the game, cursor stays the game's, no webview context menu. `overlay.rs`: the 40 ms hover loop is gone on Windows; a `WH_MOUSE_LL` hook (module `hook`, own thread, new dep `windows-sys` in `Cargo.toml`) sees every press before routing: left press on the card -> clears `WS_EX_TRANSPARENT` (drag runs), left up / other button -> click-through again. The page reports the card rect (`overlay_card`, now also feeds the hook with the scale). Non-Windows keeps the old hover loop (dev only). `Overlay.tsx`: `contextmenu` blocked, no grab cursor. D.5 (`Settings.tsx`): corner chips (a corner also clears the saved spot; none highlighted while a dragged spot exists), "Reset position" button (disabled without a saved spot), hint text fixed (no runes, says drag with left button); e2e spec asserts the disabled reset button.
- Verified: desktop typecheck + 55/55. NOT verified: Rust (never compiled here; windows-sys 0.59 signatures written from memory, x64 only: `GetWindowLongPtrW`), real dragging, right-click reaching the game, no focus steal, multi-monitor, e2e (not run). Cargo.lock will change on the first build (new dep): commit it.
- Known limits: clamp uses the whole 340x340 window (card cannot reach the bottom ~100 px); first show with a saved spot appears at the corner for one frame; a plain left click on the card (no drag) is absorbed by it. Compliance note for D.6: the hook reads global mouse state.
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
**D.6** `docs/COMPLIANCE.md` wording (`grep -n \"D\\.6\" PLAN.md`): overlay click-through except a left press on the card, right/middle clicks go to the game, Windows mouse hook only reads button and cursor state, no input sent, no game state read. Then D.7 (45 s timer is from the loading screen). If the owner reports the Rust build failing, fix that first.

## Files to Read Next
1. `docs/COMPLIANCE.md` (overlay section only: `grep -n -i overlay`, then `sed -n`).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

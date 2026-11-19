# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: overlay drag v4 (handle only).** Owner: overlay great, but right-click under it in game was blocked. Now only the card's header strip (champion icon + name, `handle` ref in `Overlay.tsx`) is the interactive/drag area: `useCardDrag` reports the handle's `getBoundingClientRect` via `overlay_card`, so Rust lifts click-through only over that strip. The card body is click-through: clicks there (right, left, middle) reach the game. Rust logic unchanged (comment only). Alt-tab hide, game-only visibility, drag/clamp/save as before.
- Verified: desktop typecheck + 55/55. NOT verified: Rust (never compiled here), real dragging/right-click in game, e2e.
- Known limits: only the ~316x44 header strip blocks clicks; clamp uses the whole 340x340 window; first show with a saved spot appears at the corner for one frame; exclusive-fullscreen games may still hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, drag/hide still wrong in game, or the handle too small/large, fix that first (ask for the compile error or the foreground window class via a debug print). Then **D.7** (`grep -n "D\.7" PLAN.md`): the 45 s timer counts from the loading screen; needs a measured loading-screen length or the game clock (P3, policy check first).

## Files to Read Next
1. `PLAN.md` D.7 line only, and `apps/desktop/src/lib/overlay.ts` (`startItemsLeftMs`).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

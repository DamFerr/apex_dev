# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: overlay drag fallback + game-only overlay + D.6.** Owner: drag worked outside League, not inside. Likely cause: the `WH_MOUSE_LL` hook gets no events while the foreground app is elevated/guarded (UIPI). `overlay.rs` `mover` thread (8 ms) now ALSO polls `GetAsyncKeyState(VK_LBUTTON)` + `GetCursorPos`: a left press that starts on the card begins a drag (`SRC` 2); when the hook does get the press it takes over (`SRC` 1, swallows press/release as before). The poll path cannot swallow, so there the press also reaches the game. Game-only: `set_overlay` got `preview` (Settings preview, shown anywhere); the mover hides/shows the window (`SW_HIDE`/`SW_SHOWNOACTIVATE`) so it is visible only while the foreground window has class `RiotWindowClass` (or the overlay itself, or a drag runs). `overlay.ts` passes `preview`. D.6 done: `docs/COMPLIANCE.md` overlay wording (click-through, hook + polling read button/cursor only, swallow only a left press on the card, only the foreground window class is read, no input sent).
- Verified: desktop typecheck + 55/55. NOT verified: Rust (never compiled here; windows-sys 0.59 signatures from memory: `GetAsyncKeyState`, `GetClassNameW`, `ShowWindow`, `POINT`; new feature `Win32_UI_Input_KeyboardAndMouse`), real dragging in game, whether the game class is really `RiotWindowClass`, e2e. Cargo.lock may change (feature only).
- Known limits: clamp uses the whole 340x340 window; first show with a saved spot appears at the corner for one frame; on the poll path a left click on the card also reaches the game; exclusive-fullscreen games may still hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
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

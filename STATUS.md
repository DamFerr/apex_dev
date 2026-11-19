# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: B.2 fully done (B.2a + B.2b).** Profile and Home both show role chips and a champion select (options from `usePool`); `useMatches(id, limit, queue, filter)` sends the optional `MatchFilter`. State is `useUi().matchFilter`, shared by Profile (your own) and Home, NOT persisted. Opening or closing another player's Profile drops the champion (role is kept), because a champion belongs to your own pool. Two e2e tests in `profile.spec.ts` (Profile, Home), not run.
- Overlay drag v4 (header strip only interactive) is in the repo, owner's in-game confirmation pending.
- Verified: desktop typecheck + 55/55 tests. NOT verified: Rust (never compiled here), in-game overlay, e2e (new test included), no unit test added (UI only).
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, or a failing e2e, fix that first. Then **F.1** (`grep -n "F\.1" PLAN.md`): inject `lcu()` into `lib/importer.ts` and add an item-set endpoint to the mock LCU (sections A to D and G, H have no open items; E.* follows).

## Files to Read Next
1. `PLAN.md` F.1 line only, `apps/desktop/src/lib/importer.ts` (grep first, over ~150 lines), `packages/lcu-mock` (name the file you need via `ls` of that one directory only if needed).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: B.1 done.** `GET /v1/players/:riotId/matches` takes optional `champion` (champion id) and `role` (TOP/JUNGLE/MID/ADC/SUPPORT; else 400). They use the same bounded scan as Arena (checked on each loaded match, `QUEUE_SCAN_MAX`, cursor counts raw ids); a single-queue filter is still sent to Riot. D.7 closed with no change (owner: timing is enough). Overlay drag v4 (only the header strip is interactive, card body click-through) is in the repo, owner's in-game confirmation pending.
- Verified: api typecheck + 283/283 tests, desktop typecheck + 55/55. NOT verified: Rust (never compiled here), in-game overlay behaviour, e2e.
- Known limits: only the ~316x44 header strip blocks clicks; clamp uses the whole 340x340 window; first show with a saved spot appears at the corner for one frame; exclusive-fullscreen games may still hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing or the overlay handle wrong in game, fix that first. Then **B.2** (`grep -n "B\.2" PLAN.md`): champion and role filter chips on Profile, using the new `champion`/`role` params (extend the typed client in `apps/desktop/src/lib/api`).

## Files to Read Next
1. `PLAN.md` B.2 line only, `apps/desktop/src/components/FilterBar.tsx`, `MatchRow.tsx` and `apps/desktop/src/lib/store.ts` (grep first, files over ~150 lines).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

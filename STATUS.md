# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: E.2c done** (scaling data, nothing uses it yet: `store.lengthBuckets` + `draftStats().lengthBuckets` rows [champion, role, bucket, games, wins] with early under 25 min / late over 33 min (`LENGTH_EARLY_SEC`, `LENGTH_LATE_SEC`); `DraftStats.lengthBuckets` in `packages/schema`; `createRealData` now returns `RealDraftData` with `scaling(champion, role)` = shrunk late minus early win rate, null under `SCALING_MIN_GAMES` (20) per bucket; constants in `model.ts`; 5 new tests). Before: **E.1** (`docs/DRAFT_TAGS.md`), Open setup button, **E.2b**, **E.2a**
- The mock locks your pick ~20 s into a draft, so in `draft.spec.ts` the helper `open()` switches `autoOpenSetup` off for every test except the lock-in one (`{ setupPage: true }`). Pending owner confirmation: the e2e run after the I.3b fixes, plus I.1 and I.3b e2e. Overlay drag v4 in-game confirmation pending.
- Verified: desktop typecheck + 86/86 unit tests, draft-engine 92/92, api 285/285. NOT verified: the new `lengthBuckets` on a real collected database (owner: restart `pnpm api`, nothing to re-collect), e2e since the recent changes, Rust, in-game overlay.
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`). Item sets still write every build type.
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Owner decision (Nov 20 2026): no more mock LCU, test seams or mock-based work; build and check everything in the desktop app. Existing mock and e2e stay untouched unless the owner says to remove them. F.1 is dropped.
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, the setup page (build chooser, fast auto-import, "Imported" badge, new draft side column) or the game-start jump to the Live tab misbehaving in the desktop app, or a failing e2e, fix that first. Then **E.2d** (scaling in the model and UI, see `docs/DRAFT_TAGS.md`: small capped layer B term in `engine.ts`/`model.ts`, a Scaling row in `CompAnalysis` with games, LOW DATA, and the word correlation).

## Files to Read Next
1. `docs/DRAFT_TAGS.md` (whole), `PLAN.md` E.2d line only, `packages/draft-engine/src/engine.ts` (`evaluate`, layer B part only), `comp.ts`, `apps/desktop/src/app/DraftPanels.tsx` (`CompAnalysis` only).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

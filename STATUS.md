# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: I.4 done** (PLAN.md section I is complete: I.1 to I.4). `useDraft.imported` (champion key an import last wrote, `lib/lcu.ts`; `wroteAnything` in `importSummary.ts`) is cleared when a new draft starts; `PickSetup.tsx` shows an "Imported" badge and the button reads "Import again". Before: I.3b opens `/draft/setup/<id>/<role>` on lock-in (`setupPathOnLock`, only from `/draft`, once per lock-in, own setting `autoOpenSetup`, on by default; connecting to an already locked draft counts as a lock-in).
- The mock locks your pick ~20 s into a draft, so in `draft.spec.ts` the helper `open()` switches `autoOpenSetup` off (a pre-load init script on `apex-ui`: connecting to a draft the previous test left running, already locked, would otherwise open the setup page before the test starts) for every test except the lock-in one (`{ setupPage: true }`).
- Owner's e2e run after I.3b: 82 of 83 passed; the 3 draft tests and Home were fixed, then `draft.spec.ts` "no simulator controls" failed (connected to a running, already locked draft: the setup page opened). Fixed again via the init script (not re-run here). Pending owner confirmation: that run, plus the I.1 and I.3b e2e. Overlay drag v4 in-game confirmation pending.
- Verified: desktop typecheck + 72/72 unit tests (2 new `wroteAnything`). NOT verified: any e2e since the I.3b fixes (owner to run), the "Imported" badge (Tauri only, needs a real client), Rust, in-game overlay.
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`). Item sets still write every build type.
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, the setup page or its "Imported" badge wrong, or a failing e2e (incl. the I.1 and I.3b ones in `draft.spec.ts`), fix that first. Then **F.1** (`grep -n "F\.1" PLAN.md`): inject `lcu()` into `lib/importer.ts` and add an item-set endpoint to the mock LCU, so import (and the "Imported" badge) is testable without Tauri. Split it if it needs more than ~4 files.

## Files to Read Next
1. `PLAN.md` F.1 line only, `apps/desktop/src/lib/importer.ts` (grep `lcu` first, then the parts that call it), `packages/lcu-mock/src/server.ts` (HTTP routes only: grep `/lol-`), `grep -n "F\.\|import test seam" docs/STATUS_ARCHIVE.md` for the old decision.

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: I.6 done** (owner: clicking felt slow). On the setup page (`PickSetup.tsx`, embeds `BuildPanel` with `pick`) a click now writes at once and only what changed (`changedSteps` in `lib/pickSetup.ts`; `runImport(key, role, sel, { build, only, quiet })` in `lib/lcu.ts`), reuses the build on screen, skips the item sets after the first import, has no success toast, and merges fast clicks into one follow-up write (latest choice wins). Before: I.5 (setup page = champion build view, game start moves you from the setup page to the Live game tab via `liveTabOnGameStart`), I.4 (`useDraft.imported`, "Imported" badge), I.3b (setup page opens on lock-in, `autoOpenSetup`).
- The mock locks your pick ~20 s into a draft, so in `draft.spec.ts` the helper `open()` switches `autoOpenSetup` off (a pre-load init script on `apex-ui`: connecting to a draft the previous test left running, already locked, would otherwise open the setup page before the test starts) for every test except the lock-in one (`{ setupPage: true }`).
- Owner's e2e run after I.3b: 82 of 83 passed; the 3 draft tests and Home were fixed, then `draft.spec.ts` "no simulator controls" failed (connected to a running, already locked draft: the setup page opened). Fixed again via the init script (not re-run here). Pending owner confirmation: that run, plus the I.1 and I.3b e2e. Overlay drag v4 in-game confirmation pending.
- Verified: desktop typecheck + 78/78 unit tests (3 new `changedSteps`). NOT verified: speed and behaviour of click imports in the real desktop app (owner to test), any e2e since the I.3b fixes, Rust, in-game overlay.
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`). Item sets still write every build type.
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Owner decision (Nov 20 2026): no more mock LCU, test seams or mock-based work; build and check everything in the desktop app. Existing mock and e2e stay untouched unless the owner says to remove them. F.1 is dropped.
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, the setup page (build chooser, fast auto-import on click, "Imported" badge) or the game-start jump to the Live tab misbehaving in the desktop app, or a failing e2e, fix that first. Then **I.7** (`grep -n "I\.7" PLAN.md`, owner request Nov 20): keep the draft information (teams, bans, win-probability bar, team composition, champion win rates) on the setup page, without the picking; split it if needed. After that **E.2**. Assumption: I.7 goes before E.2.

## Files to Read Next
1. `PLAN.md` I.7 line only, `apps/desktop/src/app/Draft.tsx` (134 lines: read it to list the panels), `apps/desktop/src/app/PickSetup.tsx` (whole), and only the components `Draft.tsx` names for the win-probability bar and team composition.

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

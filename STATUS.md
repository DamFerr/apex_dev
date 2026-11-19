# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: I.3a done** (PLAN.md section I). New `app/PickSetup.tsx` (`PickSetupPage`, route `draft/setup/:id/:role?`, id = Data Dragon id): build-type, rune-page and spell-pair pickers via `resolveSetup`, Import button calling `runImport(key, role, sel)` (Tauri + connected only). `DraftBuild.tsx` now exports `Wr` and `RuneIcons`. Nothing links to the page yet (open it by URL `#/draft/setup/Ahri/MID`). Item sets still write every build type.
- I.1 e2e (`draft.spec.ts`) not yet confirmed by the owner. Overlay drag v4 in-game confirmation pending.
- Verified: desktop typecheck + 64/64 unit tests. NOT verified: the page in a browser, e2e (none run, none added yet), Rust (never compiled here), in-game overlay.
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, the setup page looking wrong, or a failing e2e (incl. the I.1 one in `draft.spec.ts`), fix that first. Then **I.3b** (`grep -n "I\.3b" PLAN.md`): open `/draft/setup/<id>/<role>` on lock-in (without hijacking the screen when the user is elsewhere or in a game), plus an e2e on the mock LCU (lock-in opens the page, pick a spell pair, Import).

## Files to Read Next
1. `PLAN.md` I.3b line only, `apps/desktop/src/lib/lcu.ts` (`dispatch`, `runImport`, lines ~1-55), `apps/desktop/src/app/Draft.tsx` (grep `navigate\|auto\|lock`, the I.1 auto-open part), `apps/desktop/e2e/draft.spec.ts` (the `open` helper and one lock-in test only).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

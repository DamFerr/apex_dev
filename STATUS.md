# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: I.2 done** (PLAN.md section I: Draft auto-opens (I.1 done), then a setup page on lock-in). `lib/pickSetup.ts` holds `PickSetup {variantId, runePage, spellPair}` and the pure `resolveSetup`; `importRunes`, `importSpells` and `runImport(championKey, role, sel?)` use it. No UI yet, so behaviour is unchanged (top choice). I.1 e2e (`draft.spec.ts`) not yet confirmed by the owner.
- Overlay drag v4 (header strip only interactive) is in the repo, owner's in-game confirmation pending.
- Verified: desktop typecheck + 64/64 tests (5 new in `pickSetup.test.ts`). The I.1 e2e was not run. NOT verified: Rust (never compiled here), in-game overlay, e2e (new test included), no unit test added (UI only).
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, or a failing e2e (incl. the I.1 one in `draft.spec.ts`), fix that first. Then **I.3** (`grep -n "I\.3" PLAN.md`): `/draft/setup` page for the locked champion (build-type tabs, rune page and spell pair pickers, Import button) using `PickSetup` + `runImport`. Opens on lock-in. Split it if it needs more than ~4 files (e.g. I.3a page, I.3b open-on-lock).

## Files to Read Next
1. `PLAN.md` I.3 line only, `apps/desktop/src/lib/pickSetup.ts`, `apps/desktop/src/app/DraftBuild.tsx` (50 lines), `apps/desktop/src/app/App.tsx` + `lazyPages.ts` (route table only, grep `draft`), and in `BuildPanel.tsx` only the build-type tab part (grep `variant`).

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector with mock LCU, draft engine layers A+B, champion page (stat strip, build variants, runes, tables), tier list, live game, recap, static overlay v1, draft import mirroring the champion page.
- Last work: champion page tables show big coloured win rates; boots and support-item build-order fixes (ADC `roleBoundItem`); Boots options share rule.
- Not verified: e2e not run for the last several steps; Rust and the real League client never run in the build environment. Old long handoff: `docs/STATUS_ARCHIVE.md` (grep only).

## Next Step
**A.2c** (PLAN.md section 8): copy-only cleanup of the last long sentences on the champion page (Patch history caption and messages, "Keystones only..." line, "Not enough games yet..." line). Move detail into tooltips with `sr-only` text. Keep the e2e match `/Not enough games yet/` working.

## Files to Read Next
1. `apps/desktop/src/app/PatchPanel.tsx`
2. `apps/desktop/src/app/RelationsPanel.tsx`
3. `apps/desktop/src/app/BuildPanel.tsx` (only lines ~55 to 75, around "Keystones only")
4. `apps/desktop/e2e/champions.spec.ts` (only `grep -n "Not enough games"` and ~5 lines around it)

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (nothing here needs changes for A.2c).
- Rust (`src-tauri/src`) and the overlay: not part of this step.

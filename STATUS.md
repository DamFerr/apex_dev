# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector with mock LCU, draft engine layers A+B, champion page (stat strip, build variants, runes, tables), tier list, live game, recap, static overlay v1, draft import mirroring the champion page.
- Block C (one search bar, Ctrl+K palette) complete. Owner decisions (Nov 2026): the Champions "Filter champions" field stays removed; LiveGame's "Riot ID to scout" form stays; palette, champion page (1100/1400/1920 px), Profile and Home at 1100 px, full e2e, ADC boots: all confirmed ok by the owner; `SearchBox.tsx` deleted, `pnpm install` done.
- Last work: **public patch numbers** (owner prompt): Riot's public patch is the game's internal version +10 (internal 16.22 = patch 26.22). New pure `publicPatch()` in `packages/schema/src/patch.ts`; `saveMatch` stores the public number, the status bar "Patch ..." in `Shell.tsx` shows it, and opening an existing database renames stored `1x.y` patches to `2x.y` once (idempotent). Fixtures, tests, e2e specs and comments now use 26.x. Before that: removed the extra-item-fields startup log, filter menu counts follow the active filters, role item in its own slot, collector slice order, H.3a queue allow-list.
- Verified here: `pnpm --filter @apex/api typecheck`, `pnpm --filter desktop typecheck`, api tests 292/292 (new: publicPatch, stored patch number, database rename), desktop tests 39/39, both typechecks ok; e2e not run (the filter menu labels now carry counts; `backend.spec.ts` filter test and the role-item row are the ones to watch). Not verified: e2e, looks in the real app, Rust, the real League client. Old long handoff: `docs/STATUS_ARCHIVE.md` (grep only).
- Rule kept: never use `text-base` (use `text-[1rem]`). Overlay: owner does NOT want runes (see D.1); boots on the overlay follow the champion-page rule (confirmed).
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session.

## Next Step
The owner now gives the steps in chat prompts instead of PLAN.md. Parked (not started): **D.1** overlay card (`app/Overlay.tsx`): remove runes and summoner spells, keep skill order, starting items, build order; boots follow the champion-page rule (confirmed); read `docs/COMPLIANCE.md` overlay section first. Idea for later: the collector could also use Riot's `startTime` once patch dates are known; today the slice order needs no dates.

## Files to Read Next
1. `grep -n "D.1" PLAN.md` (that step only); `docs/COMPLIANCE.md` (overlay section only, grep "overlay")
2. `apps/desktop/src/app/Overlay.tsx` (grep `function` first; read only the card body)
3. `apps/desktop/src/app/BuildPanel.tsx` only for the boots rule (grep "boots")

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts` (unless a step says so), `packages/*` (except `packages/schema/src/queues.ts` for queue changes).
- Rust (`src-tauri/src`); the overlay is only touched by steps that name it (D.1: `app/Overlay.tsx`).

# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector with mock LCU, draft engine layers A+B, champion page (stat strip, build variants, runes, tables), tier list, live game, recap, static overlay v1, draft import mirroring the champion page.
- Block C (one search bar, Ctrl+K palette) complete. Owner decisions (Nov 2026): the Champions "Filter champions" field stays removed; LiveGame's "Riot ID to scout" form stays; palette, champion page (1100/1400/1920 px), Profile and Home at 1100 px, full e2e, ADC boots: all confirmed ok by the owner; `SearchBox.tsx` deleted, `pnpm install` done.
- Last work: **H.3a** queue allow-list. Chips: All, Ranked Solo/Duo, Ranked Flex, Normal Draft, ARAM, Arena (Blind, Other and an ARAM Mayhem chip dropped: Mayhem 2400 is private in Match-v5). "All" hides every other queue (Brawl, League Classic, Swiftplay, Quickplay, rotating). Files: `packages/schema/src/queues.ts`, `services/api/src/app.ts`, `Home.tsx`/`Profile.tsx` (stale stored filter falls back to All), tests `queues.test.ts`, `app.test.ts`, `e2e/profile.spec.ts`. Owner should re-run `pnpm --filter desktop test:e2e profile` (chip list changed).
- Verified here: `pnpm --filter @apex/api typecheck`, `pnpm --filter desktop typecheck`, api tests 285/285, desktop tests 39/39. Not verified: e2e, looks in the real app, Rust, the real League client. Old long handoff: `docs/STATUS_ARCHIVE.md` (grep only).
- Rule kept: never use `text-base` (use `text-[1rem]`). Overlay: owner does NOT want runes (see D.1); boots on the overlay follow the champion-page rule (confirmed).
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session.

## Next Step
**D.1** (PLAN.md section 8, D): overlay card content: remove runes and summoner spells, keep skill order, starting items, build order; boots follow the champion-page rule (owner confirmed). File: `apps/desktop/src/app/Overlay.tsx` (TS only; Rust stays untouched; this lifts the "overlay" restriction for `Overlay.tsx` only). Read `docs/COMPLIANCE.md` (overlay section) first. Not started: the owner asked to pause after the decisions round.

## Files to Read Next
1. `grep -n "D.1" PLAN.md` (that step only); `docs/COMPLIANCE.md` (overlay section only, grep "overlay")
2. `apps/desktop/src/app/Overlay.tsx` (grep `function` first; read only the card body)
3. `apps/desktop/src/app/BuildPanel.tsx` only for the boots rule (grep "boots")

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts` (unless a step says so), `packages/*` (except `packages/schema/src/queues.ts` for queue changes).
- Rust (`src-tauri/src`); the overlay is only touched by steps that name it (D.1: `app/Overlay.tsx`).

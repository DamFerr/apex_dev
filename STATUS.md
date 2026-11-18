# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector with mock LCU, draft engine layers A+B, champion page (stat strip, build variants, runes, tables), tier list, live game, recap, static overlay v1, draft import mirroring the champion page.
- Last work: **C.6b done, block C (one search bar) complete**: removed the "Filter champions" field from `app/Champions.tsx` (rows now sort a copy of the data); `champions.spec.ts` asserts the field is gone and a new test reaches LeeSin through Ctrl+K. e2e: owner run 42 passed, 1 failed (the new palette test in `champions.spec.ts` pressed Enter before the champion list loaded; fixed by waiting for the row, not re-run here; same wait added to `profile.spec.ts` and `backend.spec.ts` palette steps). Whole C block: matcher `lib/searchMatch.ts`, recents/favourites `lib/recentFavs.ts`, palette groups Pages/Champions/Players in `app/Shell.tsx` + `lib/nav.ts`, `GET /v1/players`, `useStoredPlayers`, `e2e/palette.spec.ts`; Home/Profile boxes removed; LiveGame's scout form kept on purpose. Rule kept: never use `text-base` (use `text-[1rem]`).
- e2e (owner run): 73 passed, 1 failed (champions.spec.ts WPA test expected a sign on 0.0); spec now accepts a plain 0.0, not re-run here.
- Verified: `pnpm typecheck` (desktop and `@apex/api`), `pnpm --filter desktop test` 39/39, `pnpm --filter @apex/api test` 284/284, vite build ok. Not verified: e2e (not run for the last several steps; palette look and keyboard in the real app untested), looks in the real app, Rust and the real League client. Old long handoff: `docs/STATUS_ARCHIVE.md` (grep only).
- Owner items open (PLAN.md): A.3 visual check, H.1 e2e run, H.2 ADC boots check, H.3 "Other" queue decision.

## Next Step
**D.1** (PLAN.md section 8, D): overlay card content: remove runes and summoner spells, keep skill order, starting items, build order; boots follow the champion-page rule. File: `apps/desktop/src/app/Overlay.tsx` (TS only; Rust and Do Not Touch overlay Rust stay untouched; this lifts the "overlay" restriction for `Overlay.tsx` only). Read `docs/COMPLIANCE.md` first (overlay step). Owner first: run `pnpm --filter desktop test:e2e palette profile backend champions` (all C e2e is unrun here), plus A.3 visual check and H.1 e2e run. Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session.

## Files to Read Next
1. `grep -n "D.1" PLAN.md` (that step only); `docs/COMPLIANCE.md` (overlay section only, grep "overlay")
2. `apps/desktop/src/app/Overlay.tsx` (grep `function` first; read only the card body)
3. `apps/desktop/src/app/BuildPanel.tsx` only for the boots rule (grep "boots")

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts` (unless a step says so), `packages/*`.
- Rust (`src-tauri/src`); the overlay is only touched by steps that name it (D.1: `app/Overlay.tsx`).

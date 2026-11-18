# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector with mock LCU, draft engine layers A+B, champion page (stat strip, build variants, runes, tables), tier list, live game, recap, static overlay v1, draft import mirroring the champion page.
- Last work: build panel layout per the owner's sketch (1400px+): row 1 = build variants | runes | items; row 2 = summoner spells (380px, icons and numbers on one line) | skill order stretched to fill the rest, together as wide as the three columns. Under 1400px: variants left, the rest stacked on the right (spells beside the skill order when they fit, else stacked). Earlier this chat: `text-base` fix (never use `text-base`; colour token `base` clashes, use `text-[1rem]`), A.2c copy cleanup, single rune win rate, no "-0.0", damage numbers in Profile match details.
- e2e (owner run): 73 passed, 1 failed (champions.spec.ts WPA test expected a sign on 0.0); spec now accepts a plain 0.0, not re-run here.
- Verified: `pnpm typecheck` and `pnpm test` (all 4 packages, 485 tests) pass; vite build ok. Not verified: e2e (not run for the last several steps), looks in the real app, Rust and the real League client. Old long handoff: `docs/STATUS_ARCHIVE.md` (grep only).
- Owner items open (PLAN.md): A.3 visual check, H.1 e2e run, H.2 ADC boots check, H.3 "Other" queue decision.

## Next Step
**C.1** (PLAN.md section 8, C): pure search matching function (case, space and apostrophe-insensitive: "kaisa", "wukong") in new `apps/desktop/src/lib/searchMatch.ts` with unit tests. No UI yet. Owner still to do: A.3 visual check, H.1 e2e run. Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session.

## Files to Read Next
1. `grep -n "C.1" PLAN.md` (that step only)
2. `apps/desktop/src/components/SearchBox.tsx` (how champions are matched today)
3. `apps/desktop/package.json` (only the `scripts` block, to see how unit tests run in this package)

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*`.
- Rust (`src-tauri/src`) and the overlay: not part of this step.

# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector with mock LCU, draft engine layers A+B, champion page (stat strip, build variants, runes, tables), tier list, live game, recap, static overlay v1, draft import mirroring the champion page.
- Block C (one search bar, Ctrl+K palette) complete. Owner decisions (Nov 2026): the Champions "Filter champions" field stays removed; LiveGame's "Riot ID to scout" form stays; palette, champion page (1100/1400/1920 px), Profile and Home at 1100 px, full e2e, ADC boots: all confirmed ok by the owner; `SearchBox.tsx` deleted, `pnpm install` done.
- Last work (owner prompts): **build kinds** (owner's 11 kinds + 9 mixes, see `PURE_ARCHETYPES`/`MIXED_ARCHETYPES` in the schema), reworked after the Kai'Sa screenshot (same build shown twice, AP games under On-Hit, Hybrid that was nearly all AP). In `services/api/src/build.ts` `buildVariants`: core of a game = its 3 most popular kept finished items (order-free, like the Core items block); games with the same core are one group, labelled ONCE from the core + the 3 items its games keep most (`archetype`); same-label groups are joined; then variants with the same 3 core items, or 2 of 3 and a shared kind in the label (On-Hit / On-Hit / AD), are joined into the bigger one. Hybrid needs 2+ AD and 2+ AP and smaller side >= 2/3 of the larger. `itemKinds()` reads hand-kept `ITEM_KIND_OVERRIDES` (by name; Nashor's Tooth now counts as AP scaling) before the Data Dragon stat block (`itemStats`). `BuildVariant.id` is a slug, `label` the name. Before: live game in Draft/Profile tabs + game-end popup (`GameSummary.tsx`).\n- Verified here: api typecheck + tests 308/308 (new: grouping, joins, odd extra item, strict Hybrid), desktop typecheck ok. NOT verified: on real Kai'Sa data (starting items come from timeline games only, a small sample, and follow the variant's own games), item text format vs real Data Dragon, override names vs current items, e2e, looks, Rust, League client.\n- Rule kept: never use `text-base` (use `text-[1rem]`). Overlay: owner does NOT want runes (see D.1); boots on the overlay follow the champion-page rule (confirmed).
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session.

## Next Step
The owner now gives the steps in chat prompts instead of PLAN.md. Parked (not started): **D.1** overlay card (`app/Overlay.tsx`): remove runes and summoner spells, keep skill order, starting items, build order; boots follow the champion-page rule (confirmed); read `docs/COMPLIANCE.md` overlay section first. Backlog ideas: a Settings switch for the game-end popup (today always on); a small test seam for `GameSummary`'s polling; the collector could also use Riot's `startTime` once patch dates are known; today the slice order needs no dates.

## Files to Read Next
1. `grep -n "D.1" PLAN.md` (that step only); `docs/COMPLIANCE.md` (overlay section only, grep "overlay")
2. `apps/desktop/src/app/Overlay.tsx` (grep `function` first; read only the card body)
3. `apps/desktop/src/app/BuildPanel.tsx` only for the boots rule (grep "boots")

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts` (unless a step says so), `packages/*` (except `packages/schema/src/queues.ts` for queue changes).
- Rust (`src-tauri/src`); the overlay is only touched by steps that name it (D.1: `app/Overlay.tsx`).

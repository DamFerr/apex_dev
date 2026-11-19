# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: B.2a done** (B.2 split because it needed ~7 files). Profile has role chips (click the active one to clear) and a champion select (from the player's pool) above the result filter; `ApexApi.getMatchPage`/`getRecentMatches` take an optional `MatchFilter {champion?, role?}` (champion = Data Dragon id), sent by `lib/api/http.ts`. Filter lives in `useUi().matchFilter`, NOT persisted, reset when the viewed player changes. `FilterBar.tsx` is region/patch/rank only, so chips are `MatchFilterChips` in `MatchRow.tsx`. One new e2e test (role chip) in `profile.spec.ts`, not run.
- Overlay drag v4 (header strip only interactive) is in the repo, owner's in-game confirmation pending.
- Verified: desktop typecheck + 55/55 tests, api typecheck (schema change only widens an interface). NOT verified: Rust (never compiled here), in-game overlay, e2e (new test included), no unit test added (UI only).
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`).
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, or a failing e2e, fix that first. Then **B.2b** (`grep -n "B\.2b" PLAN.md`): the same chips on Home (`useMatches` gets a `MatchFilter`, `Home.tsx`, e2e).

## Files to Read Next
1. `PLAN.md` B.2b line only, `apps/desktop/src/app/Home.tsx` (lines 1-60), `apps/desktop/src/lib/api/index.ts` lines 1-35, and the `MatchFilterChips` function at the end of `components/MatchRow.tsx`.

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

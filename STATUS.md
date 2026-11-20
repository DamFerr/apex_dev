# STATUS

## Current State
- **Last work (Nov 20 2026): owner request (live roles) + R.2b done.** (1) Live-game role estimate: `lib/liveRoles.ts` `assignRoles` takes optional `spells` per player (`LiveGameView.tsx` passes `p.spells`); small `SPELL_HINT` cost nudges (Exhaust to support, Heal to bot/support, Teleport to top/mid, Ignite to support, Cleanse to bot) next to the champion's pooled role rank, Smite still decides the jungle. Fixed along the way: the old branch-and-bound pruning breaks with negative costs, so it is gone (120 assignments, plain best-cost compare). 5 new tests. A flex pick (Yone bot, Yasuo support) can only be found when its spells point there: the champion data is pooled Ranked Solo, not per player. NOT verified on the real game (spells of that game unseen). (2) R.2b: `ApexApi.getRadar(riotId, queue?, role?)` (`packages/schema`), `http.ts` (params only when not default), `useRadar(id, queue, role)` in `lib/api/index.ts`, new `lib/api/http.test.ts` (4 tests). UI not built.
- R.2a done: `GET /v1/players/:riotId/radar` (`services/api/src/radar.ts`, schema `PlayerRadar`); latest 50 games in one role vs collected Ranked Solo role average (own tier with 30+ games, else all ranks, else no reference). Vision axis skipped (collector stores no vision score, `PLAN.md` R.2b note/backlog). R.1: pure `skillRadar` in `packages/stats-core/src/radar.ts`.
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector, draft engine, champion page, tier list, live game, recap, overlay v1, draft import, Ctrl+K palette, profile sidebar (P.1/P.2), patch-notes links (E.9), grades (E.7/E.8), lane columns (E.5/E.6), resume pick mid-game (E.10).
- E.11 (global overlay hotkey) dropped; exclusive-fullscreen overlay will not be built (needs injection). Pings dropped (Riot art not allowed). No more mock LCU or mock-based work (owner); existing mock and e2e untouched. F.1 dropped.
- Verified this step: desktop `tsc` + 116/116 unit tests (liveRoles 12, http 4). api `tsc` run. Not run: e2e (owner re-run pending since the `NEWEST` chip test fix), Rust, real app, real Riot match.
- Still NOT verified in the real app: ban buttons only in the real ban phase, player links from old games (restart `pnpm api`), Scaling row, Recap grades, E.10 allowlist line (`lcu.rs`, Rust not compiled here), overlay drag in game, the unopened `target=_blank` patch links (a `tauri-plugin-opener` needs the owner's OK).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; toggles autoImport/clickActions ON by default (owner), each action still one click. Compliance: `docs/COMPLIANCE.md`. Older detail: `docs/STATUS_ARCHIVE.md` (grep only).
- Backlog: per-player role history for live roles (needs match details of 10 players: rate limits), per-role synergies, game-end popup switch, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports a wrong live role order (send the 5 champions and their spells), the Rust build failing, the overlay, the Scaling row, lane columns, Recap grades, patch links, or a failing e2e, fix that first. Otherwise do **R.3** (`PLAN.md` section R: radar chart on the Profile overview using `useRadar`, SVG, LOW DATA badge from `low`, role switch, empty state when `reference` is null, tooltips with numbers; respect reduce motion).

## Files to Read Next
1. `PLAN.md`: `grep -n "R\.3" PLAN.md` (the line only). Then `apps/desktop/src/components/ProfileSidebar.tsx` and the `Overview` part of `apps/desktop/src/app/Profile.tsx` (`grep -n "ProfileSidebar\|Overview" ...` first), plus `grep -n "PlayerRadar" packages/schema/src/index.ts`.

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), existing `services/api/src/*.test.ts`, `packages/*` (except named by a step), Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

# STATUS

## Current State
- **Last work (Nov 20 2026): R.4 done, strength and weakness rows on the radar panel.** Pure `radarInsights` in `lib/radarInsight.ts` (6 tests): best axis = strength only if its score is 5+ above 50, worst = weakness only if 5+ below; row = icon, axis, % difference vs the rank average, tooltip with numbers and games plus `sr-only` text; nothing under LOW DATA, without a reference or under 3 axes. Rendered in `SkillRadarChart` (`components/SkillRadar.tsx`) under the axis list.
- R.3 (Nov 20): skill radar on the Profile overview: `SkillRadarChart` (SVG, dashed gold ring = rank average, drawn in, instant under reduce motion, tooltips, axis list, Overall), `RadarPanel` in `ProfileSidebar.tsx` (role chips, LOW DATA chip, empty states), pure geometry `lib/radarChart.ts`.
- Earlier this day: live roles from per-player role history (`GET /v1/live/:riotId/roles`, `liveRoleHistory.ts`, `useLiveRoleHistory`, `assignRoles` history bonus), spell hints in `assignRoles`, R.2a (`GET /v1/players/:riotId/radar`, `radar.ts`), R.2b (`getRadar`, `useRadar`), R.1 (`skillRadar` in `packages/stats-core/src/radar.ts`).
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector, draft engine, champion page, tier list, live game, recap, overlay v1, draft import, Ctrl+K palette, profile sidebar (P.1/P.2), patch-notes links (E.9), grades (E.7/E.8), lane columns (E.5/E.6), resume pick mid-game (E.10).
- E.11 (global overlay hotkey) dropped; exclusive-fullscreen overlay will not be built (needs injection). Pings dropped (Riot art not allowed). No more mock LCU or mock-based work (owner); existing mock and e2e untouched. F.1 dropped.
- Verified this step: desktop `tsc` + 132/132 unit tests (`pnpm build` ran for R.3). NOT verified: how the radar and its strength/weakness rows look and animate in the real app (no browser here), the radar endpoint against real collected data, the live-roles endpoint against Riot (rate limits with a dev key, `teamPosition`). Not run: e2e (owner re-run pending since the `NEWEST` chip test fix), Rust, real game.
- Still NOT verified in the real app: ban buttons only in the real ban phase, player links from old games (restart `pnpm api`), Scaling row, Recap grades, E.10 allowlist line (`lcu.rs`, Rust not compiled here), overlay drag in game, the unopened `target=_blank` patch links (a `tauri-plugin-opener` needs the owner's OK).
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; toggles autoImport/clickActions ON by default (owner), each action still one click. Compliance: `docs/COMPLIANCE.md`. Older detail: `docs/STATUS_ARCHIVE.md` (grep only).
- Backlog: per-role synergies, game-end popup switch, `Draft.tsx` `poolZ` overall rate, store `visionScore` in `participants` (vision axis reference).

## Next Step
If the owner reports a wrong live role order (check the `/roles` endpoint output first), a radar layout or data problem, the Rust build failing, the overlay, the Scaling row, lane columns, Recap grades, patch links, or a failing e2e, fix that first. Otherwise the radar is finished for P3; pick the next P3 item from `PLAN.md` ("P3 and later": champion pool analysis is the natural one) and split it into a one-line step before building. The vision axis needs the backlog item (`visionScore` in `participants`) first.

## Files to Read Next
1. `grep -n "P3 and later" PLAN.md` then `sed -n` that section only; `usePool` in `apps/desktop/src/lib/api/index.ts` (`grep -n`) and `PoolEntry` in `packages/schema/src/index.ts`.

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), existing `services/api/src/*.test.ts`, `packages/*` (except named by a step), Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

# Apex status (handoff file, updated in every step)

## Current state (Phase 1 complete, Phase 2 data engine in progress)
- Desktop app (Tauri 2, React, TS, Vite, Tailwind, Zustand, TanStack Query): shell, design system, Home, Profile + match detail + mastery, Champions, Champion page, Tier List, Live Game, Post-game recap, Draft, Settings. **Every screen shows real data from the local backend; there is no mock data source, no demo player and no synthetic draft data.**
- Local backend `services/api` (Fastify + Node SQLite): Riot client with rate limiter, retries and cache; data collector (all regions x ranks); stats endpoints; draft data; live game; recap.
- First run: Home, Profile and Recap ask for your Riot ID (stored on this device only). Draft suggestions appear once the collector has games for the current filters.

## How to run
`copy services\api\.env.example services\api\.env`, put your key in `RIOT_API_KEY`, then `pnpm install`, `pnpm api`, `pnpm tauri dev`. Set your Riot ID in Settings (or on the first-run prompt).

## Cleanup step (this step)
- Removed: mock API (`lib/api/mock.ts`), the Mock/Local-backend switch, demo Riot ID, synthetic draft data (`draft-engine/mock.ts`), the mock-LCU controls and "(mock)" labels in the UI, the LP history tab (no data source yet), the Analysis and Pro "coming soon" pages and nav entries, the overlay/language/telemetry settings (not functional), and all "placeholder" wording.
- Kept as test-only tooling, invisible in the app: `services/api/src/fake-server.ts` + `testkit.ts` (fake Riot for e2e and unit tests), `packages/lcu-mock` (League client simulator; the browser dev preview connects to it automatically, drive it with `curl -X POST http://127.0.0.1:8765/scenario/normal|dodge|reset`).
- Local settings are migrated (store version 1): an old saved demo Riot ID is cleared and removed settings are dropped.
- Fixed: re-binding a hotkey also fired it (rebinding compact mode toggled compact mode).
- e2e tests now run against the fake-Riot test API (39 tests) and include a guard that no screen shows mock/demo/placeholder wording.

## Decisions
- Ranks are cumulative: "Emerald+" = Emerald IV and above. Collector reads every division ladder (I-IV) of every tier. A match is filed under the tier of the seed player it was found through.
- Riot limits are per routing host. Match-v5 uses 4 clusters (europe, americas, asia, sea), ladders/league use platform hosts. The collector picks its next player from the cluster with the fewest busy workers so all four limits stay in use.
- Network errors and Riot 5xx are retried (3 and 2 times, growing pause) inside `HttpRiot`; the final message names the real cause.
- Collector status only shows an error while it is recent (3 min) or fatal (bad key).
- Tier list hides champions with too few games in a role: under max(50, 0.5% of the role's games). A champion only counts in a role when that role is >= 10% of its games.
- Champion display names come from Data Dragon on the client (`useChampName`), never the raw id.
- Rune and summoner spell import use class- and role-based defaults (labelled as such) until build data is collected.
- The overlay window code (`overlay.rs`, `Overlay.tsx`) stays as groundwork but is not reachable from the UI until it has real content.

## Known issues / limits
- A development key caps collection at roughly 3 games/s total (100 req / 2 min per cluster). Only a production key raises it.
- A player stays filed under the tier they were first seeded at (rank changes are not re-read until the weekly ladder refresh).
- Not collected yet: LP history, skill orders, item sets. Tier list shows an empty state until a role has enough games.
- The real League client connector (Rust) still needs testing on your machine.

## Next steps
1. Item sets and real rune pages from collected data; skill order from timelines.
2. LP history (needs rank snapshots over time).
3. Roadmap P2: matchup/synergy tables, patch deltas, overlay v1 (restore the overlay setting when it has content).

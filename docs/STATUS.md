# Apex status (handoff file, updated in every step)

## Current state (Phase 1 complete, Phase 2 data engine in progress)
- **Latest step: timelines.** The collector now fetches the Match-v5 timeline for a deterministic share of newly stored games (`COLLECT_TIMELINES`, default 0.25; 0 = off; one extra Riot request each, so about 20% slower collection at 0.25). From it Apex stores per player the skill order, starting items (bought in the first 90 s, undone purchases removed) and all later purchases. `/v1/champions/:id/build` gained `skillOrder` (max priority + most common first 9 levels), `startItems`, `corePath` (first three finished items in order) and `timelineGames`; the champion page shows them and the old empty "Skill order" row is filled. The item set import adds "Starting items" and "Build order" blocks when available.
- **Previous step: data-based builds.** `GET /v1/champions/:id/build?role&patch&region&rank` returns the most played rune pages (grouped by primary tree + keystone + secondary tree, each slot filled with the most common choice in that group), the most played summoner spell pair and final-inventory item blocks (Boots / Core / Situational). The champion page shows it ("Recommended build"); the Draft import now writes the collected rune page, spells and an item set, falling back to class/role defaults (and saying so in the import log) when fewer than 10 games exist.
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
- Timeline data lives in three new `participants` columns (`skills`, `start`, `buys`, JSON), added automatically to existing databases. Skill order = order in which Q, W, E reach rank 5; the first-9-levels line is a real sequence from games with that max order. Core path groups games by their exact first three finished items, so its sample is smaller than the other stats and says so.
- Ranks are cumulative: "Emerald+" = Emerald IV and above. Collector reads every division ladder (I-IV) of every tier. A match is filed under the tier of the seed player it was found through.
- Riot limits are per routing host. Match-v5 uses 4 clusters (europe, americas, asia, sea), ladders/league use platform hosts. The collector picks its next player from the cluster with the fewest busy workers so all four limits stay in use.
- Network errors and Riot 5xx are retried (3 and 2 times, growing pause) inside `HttpRiot`; the final message names the real cause.
- Collector status only shows an error while it is recent (3 min) or fatal (bad key).
- Tier list hides champions with too few games in a role: under max(50, 0.5% of the role's games). A champion only counts in a role when that role is >= 10% of its games.
- Champion display names come from Data Dragon on the client (`useChampName`), never the raw id.
- Rune, spell and item set import use collected games when the top rune setup has at least 10 games (`MIN_BUILD_GAMES`); otherwise class/role defaults, labelled as such in the import log. Lookup order: current filters + role, then all patches + role, then all patches + any role.
- Rune page = real data only: primary runes and shards are per-slot modes within the most played setup; the secondary pair is the most common real pair (so the page is always valid). The win rate shown is the whole setup's, never an invented combination.
- Items are FINAL inventories (what players owned at game end), not a build order; starting items and order need timelines. Boots = Data Dragon tag Boots with no upgrade; other items must cost 2000+ and have no upgrade.
- Item sets: the client replaces its whole list on write, so Apex reads the list first, keeps every set that is not titled "Apex: ..." untouched, replaces only its own set for that champion (uid `apex-<championKey>`), keeps at most 15 Apex sets, and writes nothing if the list cannot be read.
- The Rust request allowlist now also permits GET `/lol-summoner/v1/current-summoner` and GET/PUT `/lol-item-sets/v1/item-sets/<numeric id>/sets`, nothing else under those prefixes.
- `participants` has a new `perks` column (full rune page as JSON), added automatically to existing databases. Games collected before this step have no rune page and are ignored by rune stats (item and spell stats still use them).
- The overlay window code (`overlay.rs`, `Overlay.tsx`) stays as groundwork but is not reachable from the UI until it has real content.

## Known issues / limits
- A development key caps collection at roughly 3 games/s total (100 req / 2 min per cluster). Only a production key raises it.
- A player stays filed under the tier they were first seeded at (rank changes are not re-read until the weekly ladder refresh).
- Only a share of games have timelines, and games collected before this step have none. There is no backfill yet, so skill order, starting items and build order fill in as new games arrive (a champion needs enough timeline games; every stat shows its sample size).
- Not collected yet: LP history.
- Item set import and the new Rust allowlist entries have NOT been run against a real League client yet (no client or Rust toolchain in the build environment). Test: Draft screen, Import now, then check the item sets in the client's item shop. Tier list shows an empty state until a role has enough games.
- The real League client connector (Rust) still needs testing on your machine.

## Next steps
1. LP history (needs rank snapshots over time).
2. Setting: choose which summoner spell slot Flash goes on, left (D) or right (F). Today Flash is always on the second slot (F): `recommendSpells` in `packages/lcu-core/src/spells.ts` and the pair ordering in `spellPair` in `services/api/src/build.ts`. Plan: add a `flashSlot: "D" | "F"` option to the settings store (default "F", so nothing changes for anyone), a toggle in Settings, and have `importSpells` in `apps/desktop/src/lib/importer.ts` swap the pair when it is "D". Keep the swap on the client only, so the backend stays slot-agnostic. Unit-test the swap, including pairs without Flash.
3. Optional: backfill timelines for already stored games; per-role skill order on the champion page.
4. Roadmap P2: matchup/synergy tables, patch deltas, overlay v1 (restore the overlay setting when it has content).

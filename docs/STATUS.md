# Apex status (handoff file, updated in every step)

Read this first in a new chat, then the PDF (master plan) and the repo. The repo wins over the PDF where they differ.

## 1. Where we are
Phase 1 (Core Desktop MVP) is complete. Phase 2 (data engine and draft) is mostly done. We are in the middle of the **champion page redesign** (owner round 2, see section 5).

Last verified (build environment, no League client, no Rust toolchain): typecheck, web build and unit tests (71 stats-core, 59 lcu-core, 54 draft-engine, 231 API) pass. The e2e suite (66 tests passed two steps ago) was NOT run for the last two steps (stat strip, then less text + single-build fix): no browser can be installed in the build environment. Run `pnpm --filter desktop test:e2e` locally. New tests: "champion page starts with a strip of key numbers", "with too little data for separate variants the left column shows the one build", "long explanations live in tooltips..."; changed: the old "no variant list" test and the WPA sentence match (`/^WPA: win probability added/`).

## 2. How to run (Windows, PowerShell)
```
copy services\api\.env.example services\api\.env     # put your key in RIOT_API_KEY (never commit it)
pnpm install
pnpm api            # local backend (collector, stats, draft data)
pnpm tauri dev      # desktop app
pnpm --filter desktop test:e2e    # e2e tests
```
Set your Riot ID in Settings (or the first-run prompt). Env variables are documented in `services/api/.env.example` (notable: `RIOT_API_KEY`, `COLLECT_TIMELINES` default 0.25, `COLLECT_BACKFILL` default 1).

## 3. What is built (done)
**App and shell:** Tauri 2, React, TS, Vite, Tailwind, Zustand, TanStack Query. Design system, frameless shell, sidebar, Ctrl+K palette, themes (dark, light, colorblind), reduce-motion. Every screen shows real data from the local backend (no mock source, no demo data).
**Screens:** Home, Profile (match history, expandable match detail, mastery, LP history tab), Champions browser, Champion page, Tier List (Tiers and Patch changes tabs), Live Game, Post-game recap, Draft (champ select assistant), Settings.
**Backend `services/api`:** Fastify + Node SQLite, Riot client (rate limiter, retries, cache), collector (all regions x ranks, ranked solo 420 only, timelines for a share of games, timeline backfill), stats endpoints, draft data, live game, recap. Only the 5 newest patches are kept (automatic cleanup + VACUUM).
**Champion data:**
- Matchups and synergy (log-odds expected values, shrunk, Wilson ranges), patch history and patch deltas (50-game minimum), item WPA (win probability added, strata by game length and finished items), starting items, build order, skill order (needs 10+ timeline games), keystone fallback, boots rule (Data Dragon tag Boots, cost 800+).
- **Build variants (AP / AD / Tank)**, grouped from the tags of finished items (`archetype`, `buildVariants` in `services/api/src/build.ts`; a variant needs 10+ games and 5% of classified games, max 3, at least 2 or none). Sort tabs Best (lower end of the 95% range) / Win rate / Common.
- **Stat strip** (`apps/desktop/src/app/StatStrip.tsx`, top of the champion page, replaces the four stat cards): Tier (grade in the champion's busiest role, from `buildTierList`, dash when the role has too few games), adjusted win rate coloured by `winRateBand` (`packages/stats-core/src/winRateBand.ts`: bad under 48%, good over 52%, 2 tests; number always shown), change vs the previous patch (`patchDelta`, coloured only when significant, dash under 50 games in either patch), pick rate, ban rate, games with the low-data badge. Hints are tooltips, not sentences.
- **Left column never empty:** with no AP/AD/Tank split the left column shows one selected "Most played" row (games, win rate, keystone + first items) instead of nothing. `ChampionBuild.wins` (optional) carries the base build's wins. Sort tabs appear only when there are variants to sort.
- **One win-rate colour scale everywhere:** `wrClass()` in `components/StatRows.tsx` (uses `winRateBand`: red under 48%, neutral 48-52%, green over 52%) replaced the old `>= 50%` good/bad split in the build panel, Items/Keystone tables, matchup tables, patch history, Champions list, Tier List and Live Game. Still hand-set; tune on real data.
- Build panel (`apps/desktop/src/app/BuildPanel.tsx`): variant list, full rune trees with chosen runes lit and 3 shard rows, two summoner spell pairs, items with arrows (starting items, build order including boots when 40%+ of games have them, situational), 18-level ability grid (levels 1-9 real, later levels follow the max order). Last fix: round highlight rings, compact layout, fixed grid cells (checked at 1100 and 1920 px).
**LCU / overlay:** LCU connector against a mock LCU server (`packages/lcu-mock`), champ select state machine, runes/spells/item set import (client replaces the item set list, Apex only touches sets titled "Apex: ..."), Flash key setting, auto-refresh of own rank after a game. Overlay v1 = static build card, off by default, 4 corners, click-through (Rust never compiled or run here).
**Draft engine:** layers A (log-odds champion/matchup/synergy) and B (comp: damage balance, frontline, CC; measured per champion and role when 20+ games, else class tags). Team comp analyzer panel.
**Compliance:** see `docs/COMPLIANCE.md` (no hidden info, no automation, assets only from Data Dragon, own rank emblems and role glyphs, no MMR estimates, no power-spike alerts, no names in ranked champ select).

## 4. Key decisions (still valid)
- Statistics: every win rate is Bayesian-shrunk toward 50% (prior 50) with a Wilson 95% range and its sample size; "low data" badge under 50 games. Matchup/synergy "expected" uses additive log-odds, not a product of win rates.
- Patch window: the 5 newest patches by numeric order; games outside are refused and old ones deleted permanently. `rank_snapshots` and `seeds` are never deleted.
- Ranks are cumulative ("Emerald+" = Emerald IV and up). A match is filed under the tier of the seed player it was found through.
- Riot limits are per routing host (4 Match-v5 clusters, platform hosts for ladders). A dev key allows about 3 games/s in total.
- Items are FINAL inventories; order and starting items come from the timeline sample (`MIN_PATH_GAMES` = 10). Runes: real pages only (per-slot modes within the most played setup), win rate is the whole page's.
- Champion ids are normalised to Data Dragon spelling (`RIOT_CHAMPION_ALIASES`, e.g. FiddleSticks); add a line there if another champion shows a wrong name or icon.
- Original rune layout was preferred by the owner earlier; the new full-tree layout was requested in round 2 and is now the one in use.
- Overlay: static pre-game build card only, no game state; no Live Client Data until compliance is re-checked.
- Rank emblems (`TierIcon`) are our own drawings; Riot's are not allowed.
- Local settings in the `apex-ui` store (version 1 migration); API key only in `services/api/.env`.

## 5. Next steps (in order)
**A. Finish the champion page (owner round 2).**
1. ~~Stat strip on top of the champion page~~ DONE (see section 3).
2. ~~Less text, more numbers, colours and icons~~ DONE for the champion page and build panel (long notes are now tooltips with a short line on the page; the winRateBand adoption is done, see section 3). Original note: big coloured numbers, short labels, "low data" badge, long notes shortened (the title-tooltip approach used in the build panel is the pattern). The shared helper now exists as `winRateBand()` in stats-core (used by the strip only so far): adopt it in the build panel, the Items/Keystone/matchup tables and the tier list instead of the current `>= 50%` good/bad split. Update e2e tests that look for old sentences in the same step.
3. Leave out "OTP builds" and "Pro builds" lists until there is a real data source (PDF P4).

**B. Match history (Profile and Home).** One shared row built around champion icons (level, win/loss strip, KDA, CS, `LoadoutIcons`, queue, short "time ago"), and a queue filter (All, Ranked Solo/Duo, Ranked Flex, Normal Draft, Blind, ARAM, Arena, Other) applied on the backend with Match-v5's `queue` parameter (`GET /v1/players/:riotId/matches?queue=`), remembered per device. Check Riot's current queue ids before hard-coding them. The collector still reads ranked solo only; this only changes what the profile shows.

**C. One search bar (not before A and B).** Merge searching into the top bar / Ctrl+K palette: grouped suggestions for Champions (icon, case/space/apostrophe-insensitive: "kaisa", "wukong"), Players and Pages. Players honestly: Riot has no name-prefix search, so suggestions come from recent searches and favourites (local), players Apex already stored, and a "Look up name#tag" entry when the text looks like a Riot ID; no Riot calls while typing. Then remove the other search boxes (Home quick search, Champions search, Profile search field). Keyboard: arrows, Enter, Esc. Tests: matching function, recent/favourites store, e2e.

**D. Overlay changes (needs Rust, unverified until run on the owner's machine).** Remove runes and summoner spells from the overlay card (keep skill order, starting items, build order). Boots: reuse the champion page rule (inline in the build order when it has one, else a small separate group). Movable with the mouse via an explicit "Move overlay" mode in Settings (not click-through while moving, visible frame, saved free position per monitor with scale factor, corner presets and "Reset position", auto-leave move mode when the game phase changes, fall back to the primary monitor's top-left if the saved monitor is gone). Position clamping as a pure function in `lcu-core` with tests; settings migration (store version bump); one line in COMPLIANCE.md (still a static pre-game card).

**E. Then the roadmap (PDF Section 8), Phase 2 remainder and Phase 3+.** Read the PDF again at the start of the next chat to pick the next item. Known open items from earlier notes: draft layer B features engage/peel/poke/scaling/waveclear (need a real source, do not guess from class tags); restoring the overlay hotkey needs the global-shortcut plugin; reading the locked champion from the gameflow session so the overlay works when Apex starts mid-game.

## 6. Known issues and limits
- **Never run here:** all Rust (`overlay.rs`, `lib.rs`, the LCU connector), item set import and the Rust request allowlist against a real League client. Test on your machine: Draft screen, Import now, check the item sets in the client's shop.
- **Not checked with real data/pictures:** the champion page with the real Data Dragon (tests use a fake one), shard icon file names (`SHARD_ICONS`, a wrong name falls back to initials), `SHARD_ROWS` (written from the current shard layout; the UI adds a chosen shard that is not listed), plausibility of WPA and patch deltas on real collected data, VACUUM time on a multi-GB database.
- **Data fills in over time:** full rune pages, damage-type profiles (20+ games per champion and role) and timelines exist only for games collected after those features; skill order, starting items and build order need 10+ timeline games and otherwise show "not enough games yet". Rarely played champions often have no variants.
- Variants are labelled from item tags only (AP/AD/Tank); a game with fewer than 3 finished items is not classified.
- Overlay: does not know your champion if Apex starts after the game began; one of four corners of the primary monitor only; League must run in Borderless (exclusive fullscreen cannot show an overlay); build fetched once at lock-in.
- Patch deltas and WPA are correlations, not proof (the UI says so); the patch endpoints scan the whole participants table and are cached for 10 minutes.
- Team comp: damage taken and CC rows need both teams fully measured; otherwise a labelled class-tag estimate.
- LP history only knows the moments Apex looked (no Riot history endpoint); snapshots only for profile lookups.
- A game pushed out of the 5-patch window is downloaded and refused once more after restart (about 1 request).
- A player stays filed under the tier they were first seeded at until the weekly ladder refresh.
- Only a production Riot key raises the collection speed.

# PROJECT APEX: MASTER PLAN

Converted from the "Project Apex" PDF and aligned with the repo (repo wins on any difference, see section 4).
**Do not read this whole file in a coding turn.** Read only the section of the current step ID (`grep -n "A.2c" PLAN.md`).

Status legend: ✅ done · ✅\* done but not verified on a real League client / e2e / real data · ◐ partial · ⬜ not started · ? not mentioned in the handoff, check the code before planning.

---

## 1. Vision and principles
1. One app, zero tab switching: before, during and after a game, in one window plus an optional overlay.
2. Statistical honesty: sample sizes, intervals, Bayesian-adjusted win rates everywhere.
3. Depth on demand: simple defaults, every filter and raw number for analysts.
4. Fast: draft recommendations under 150 ms locally.
5. Respect the rules: no hidden information, no gameplay automation.

Where Apex should beat Blitz / DPM.lol / Lolalytics / U.GG / DraftGap / iTero: one unified model (draft win probability that also knows your champion pool), personalized recommendations, an account analysis that explains why you are stuck, one consistent data pipeline behind every screen.

## 2. Scope decisions
- Platform: Windows first (League client and Vanguard), macOS second, no Linux.
- Data: only the official Riot API (Match-v5 + timeline, Summoner, League, Spectator-v5, Champion-Mastery, Account-v1) plus Data Dragon / Community Dragon. No scraping of competitor sites.
- Personal project vs commercial product: **undecided** (affects Riot monetization rules, see section 11).

## 3. Repo layout (actual)
| Path | Purpose |
|---|---|
| `apps/desktop/src/app` | Screens: Home, Profile, Champions, ChampionPage, TierList, LiveGame, Recap, Draft, Settings, Overlay, Shell |
| `apps/desktop/src/components` | Design system and shared components (MatchRow, FilterBar, StatRows, icons, Tabs, Toaster, ui) |
| `apps/desktop/src/lib` | API client (`lib/api`), store, LCU/overlay/importer glue, hotkeys, formatters |
| `apps/desktop/src-tauri/src` | Rust: `lcu.rs`, `overlay.rs`, `lib.rs` |
| `apps/desktop/e2e` | Playwright specs |
| `services/api/src` | Fastify + Node SQLite backend: Riot client, rate limiter, collector, build/stat computation, endpoints |
| `packages/schema` | Shared types and queue definitions |
| `packages/stats-core` | Wilson, Bayesian shrinkage, ladder, patch delta, win-rate band, WPA, timeAgo |
| `packages/lcu-core` | Champ select state machine, runes/spells/items import logic, overlay position logic, `pageBuild` |
| `packages/lcu-mock` | Mock LCU server (bans, swaps, trades, dodges) |
| `packages/draft-engine` | Draft layers A+B, comp analysis, personal layer |
| `docs/COMPLIANCE.md` | Riot policy rules as applied in this repo |
| `docs/STATUS_ARCHIVE.md` | Old long handoff (grep only) |

## 4. Where the repo differs from the original PDF
- Backend is a **local Fastify + Node SQLite service** (`services/api`), not the PDF's Rust/Go + ClickHouse + Postgres + Redis cloud stack. Aggregates are computed from stored games in SQLite; only the 5 newest patches are kept.
- No mock data source: every screen reads the real local backend (no demo data).
- Collector reads **Ranked Solo/Duo (420) only**, all regions x ranks, timelines for a share of games (`COLLECT_TIMELINES`), with timeline backfill.
- No ONNX inference, no sqlx, no gRPC; layers C and D of the draft model are not built (see E-steps and P3).
- Shared package names: `@apex/schema`, `@apex/stats-core`, `@apex/lcu-core`, `@apex/lcu-mock`, `@apex/draft-engine`, `@apex/api`. No `game-data`, `config` or `ml` packages yet.
- Rust has never been compiled or run in the build environment (owner tests on his machine).

## 5. The win-rate engine (condensed)
**Dimensions (filters):** patch, region, rank bracket (cumulative: "Emerald+" = Emerald IV and up), queue, role, champion / opponent / teammate, game length, side, first-blood / first-objective, items / runes / spells / skill order, mastery, time of day (personal only).
**Metrics:** outcome (win/pick/ban rate, presence, games); statistical (Wilson interval, shrunk win rate, z-score, delta vs role average); laning (gold/CS/XP diff at 5/10/15/20); combat (KDA, KP, DPM, damage share, CC); economy; objectives; vision; duo/synergy (delta over expected); matchup; meta (tier score, trend, patch delta).
**Methodology:**
1. Bayesian shrinkage of small samples toward a prior (repo: prior 50, toward 50%).
2. Wilson intervals as hover detail; "low data" badge under threshold (repo: under 50 games).
3. Confounder control: raw and adjusted matchup/synergy (PDF: logistic regression; repo: additive log-odds expected values).
4. Patch weighting with exponential decay (repo: 5-patch window instead).
5. Skill-conditioned win rates for "expert" champions (⬜).

**Draft win-probability model (layers):** A baseline (champion-in-role + matchup + synergy, summed in log-odds) ✅. B comp features (damage balance, engage/peel/poke, scaling, waveclear, CC, tankiness) ◐ (damage balance, frontline, CC measured; engage/peel/poke/scaling/waveclear need a real source, do not guess from class tags). C ML model (gradient-boosted trees or small NN on 10-champion drafts, ONNX local) ⬜ P3. D personalization (own win rate, mastery, recent form, shrunk to population) ◐ (`personal.ts` exists, check scope). Output: win probability with confidence band plus top-3 explanations.
**AI coaching layer (P4):** language model turns a verified stats payload into advice; never invents numbers; links to evidence.

## 6. Feature catalogue and status
### 6.1 Draft assistant
| Feature | Phase | Status |
|---|---|---|
| Champ select detection via LCU (picks, bans, roles, swaps, trades) | P1 | ✅\* |
| Auto-import runes, item sets, summoner spells on lock (mirrors champion page) | P1 | ✅\* |
| Auto-accept, auto-pick/ban hover (optional, OFF by default) | P1 | ? |
| Pick recommendations ranked by win probability for your role | P2 | ◐ engine A+B; check UI |
| Ban recommendations (personal, meta, lane-opponent pool) | P2 | ? |
| Live win-probability bar | P2 | ? |
| Team comp analyzer | P2 | ◐ |
| Synergy / counter heatmaps | P2 | ◐ tables on champion page, no heatmap |
| Personal pool overlay on suggestions | P2 | ? |
| Role-swap/trade suggestions, offline draft simulator, predicted enemy picks | P3 | ⬜ |
| Pro draft mode (Fearless, Bo3/Bo5) | P4 | ⬜ |

### 6.2 Champion pages and builds
| Feature | Phase | Status |
|---|---|---|
| Win/pick/ban rate (stat strip with tier, change vs previous patch) | P1 | ✅ |
| Builds: starting items, boots, build order, core, situational, support item | P2 | ✅ |
| Build types: every game named from starter, boots and core 3 by a weighted trait score, rolled up per name, situational items per build | P2 | ✅ (rebuilt Nov 2026, see STATUS) |
| Runes (full trees, page-level win rate, shards) | P2 | ✅ |
| Skill order, summoner spells | P2 | ✅ (skill order needs 10+ timeline games) |
| Matchup table, synergy table (expected vs actual, shrunk, Wilson) | P2 | ✅ |
| Lane diffs: gold/CS/XP at 10/15/20, solo kills, first blood | P2 | ◐ matchup WR only; diffs ? |
| Patch change tracking | P2 | ✅ (auto-linked patch notes ?) |
| Win rate by game length / first-item time / lane lead | P3 | ◐ WPA strata only |
| Counter-pick difficulty, power-spike timelines | P3 | ⬜ (power-spike alerts excluded by compliance) |
| Pro builds, OTP builds | P4 | ⬜ (left out until a real data source exists) |
| Curated tips | P5 | ⬜ |

### 6.3 Tier lists and meta
| Feature | Phase | Status |
|---|---|---|
| Tier list per role/rank/region/patch (Ranked Solo) | P2 | ✅ (other queues ⬜) |
| Custom score formula with user weights | P3 | ⬜ |
| Meta trackers (rising/falling, hidden gems) | P3 | ◐ Patch changes tab |
| ARAM / Arena / rotating-mode stats | P3 | ⬜ (collector reads 420 only) |
| Item and rune stats pages | P3 | ⬜ |
| Leaderboards | P4 | ⬜ |

### 6.4 Summoner profile and match history
| Feature | Phase | Status |
|---|---|---|
| Riot ID search, recent searches, favourites | P1 | ✅ |
| Rank, LP history, peak/season history | P1 | ◐ LP history only from Apex lookups; no peak/season |
| Match history, infinite scroll, queue filter | P1 | ✅ |
| Match history filters champion / role / patch / date | P1 | ⬜ optional |
| Match detail (scoreboard, builds, runes, KDA, damage, vision) | P1 | ✅ |
| Mastery view | P1 | ✅ |
| Per-player champion stats | P1 | ? |
| Timeline view (gold/XP graphs, kill map, events) | P2 | ? |
| Role/queue distribution, tilt, compare players, duo detection | P3 | ⬜ |
| Smurf estimate (labelled), profile sharing, OBS widget | P4 | ⬜ |

### 6.5 Live game scouting
| Feature | Phase | Status |
|---|---|---|
| Live game lookup via Spectator-v5, 10 players with rank and form | P2 | ✅\* |
| Team strength, lane predictions, premade hints | P3 | ⬜ |
Never show information the game itself hides.

### 6.6 Account analysis (differentiator)
| Feature | Phase | Status |
|---|---|---|
| Performance score per game/champion (normalized by role, rank, patch) | P2 | ✅ per game vs rank and own average (E.7/E.8); per champion not done |
| Skill radar, strengths/weaknesses report with evidence, champion pool analysis, rank-up roadmap, improvement tracker, vision heatmaps, build review | P3 | ⬜ |
| Replay key moments, AI coaching summary | P4 | ⬜ |

### 6.7 In-game overlay (Windows)
| Feature | Phase | Status |
|---|---|---|
| Overlay v1: static pre-game build card, 4 corners, click-through, OFF by default | P2 | ◐ (Rust never run here) |
| Movable overlay, position per monitor | P2 | ⬜ (steps D.*) |
| Click-tracked cooldown timers, objective timers, gold/item indicators (Live Client Data API), personal goals, layout/hotkeys | P3-P4 | ⬜ blocked until compliance re-check (no Live Client Data now) |

### 6.8 Post-game
| Feature | Phase | Status |
|---|---|---|
| Automatic recap (score, ranking vs lobby, LP change, key stats) | P2 | ✅ |
| Performance grade vs your average and vs rank average | P2 | ? |
| Highlight timeline, mistakes list, build vs winning baseline | P3 | ⬜ |
| One-click share | P4 | ⬜ |

### 6.9 Esports and pro play (all P4 ⬜)
Pro accounts, pro builds/runes, pro draft database, Fearless support.

### 6.10 Social and utility
| Feature | Phase | Status |
|---|---|---|
| Themes (dark, light, colorblind), accessibility | P2 | ✅ |
| Friends list via LCU, notifications, patch notes reader with impact score, local player notes | P3 | ⬜ |
| Localization (EN first), settings sync / cloud backup | P4 | ? / ⬜ |
| Duo finder (opt-in), plugin/API system | P5 | ⬜ |

## 7. Roadmap and phase gates
| Phase | Scope | Exit criteria | Status |
|---|---|---|---|
| P0 Foundation | Audit, legal review, API key, stack, design system, scaffold, CI | Approved architecture, key submitted | done (scaffold, CI, design system exist) |
| P1 Core Desktop MVP | Tauri shell, LCU connector, auto-import, Riot ID search, rank, history, mastery, champion page | User can search, browse matches, get runes auto-imported | ✅ complete |
| P2 Data Engine + Draft v1 | Ingestion, aggregates, champion/matchup/synergy, tier lists, live game, draft recs (A+B), recap, overlay v1 | Stats match third-party within tolerance; draft assistant usable in real games | mostly done, remainder in section 8 |
| P3 Analysis and Intelligence | Performance score, radar, insights, pool analysis, ML draft (C+D), advanced filters, ARAM/Arena, duo detection, notifications | Account reports, personalized draft recs | ⬜ |
| P4 Pro, Social, Scale | Pro data, leaderboards, sharing, localization, AI coaching, sync, smurf score | Public beta | ⬜ |
| P5 Ecosystem | Plugins/API, duo board, mobile, web app | 1.0 | ⬜ |
Rule: P1 ships before P2 starts; do not start a phase before its predecessor's exit criteria are met, but design modules so later phases plug in.

## 8. STEP BACKLOG (single-purpose steps, in execution order)
Rules: one step per turn; max ~4 source files plus tests; if a step grows, split it here first. `[ ]` = open, `[x]` = done. Owner-only steps are marked (owner).

### Done (one line each, details in `docs/STATUS_ARCHIVE.md`)
- [x] P1 complete (shell, LCU connector + mock, import, search, profile, mastery, champion basics, settings).
- [x] A.1 Champion stat strip. [x] A.2a Build panel: big coloured numbers. [x] A.2b Tables: big coloured win rates.
- [x] B Match history: shared `MatchRow`, queue filter (backend `?queue=`).
- [x] F Draft import mirrors the champion page (`lcu-core/pageBuild.ts`).
- [x] Fix: `text-base` painted text near-black (see STATUS). [x] Build fixes: boots rule, support item slot, ADC role-bound boots (`roleBoundItem`), boots options share.

### A. Finish the champion page
- [x] **A.2c Copy read-through.** Copy only, no logic: shorten the remaining long sentences on the champion page: `PatchPanel.tsx` (the long caption under the table, the "could not be loaded" and "No collected games..." lines), `BuildPanel.tsx` ("Keystones only · full pages need newer games" and its tooltip), `RelationsPanel.tsx` ("Not enough games yet: a pairing needs 5+ games..."). Move detail into tooltips with `sr-only` text. Keep the e2e text match `/Not enough games yet/` in `e2e/champions.spec.ts` line ~115 working (keep the phrase or update the spec). Done when: typecheck passes, no sentence longer than ~8 words stays visible, tooltips carry the detail.
- [x] **A.3 (owner) Visual check** of the champion page at 1100, 1400 and 1920 px: owner confirmed it works as intended (Nov 2026).

### H. Hygiene and owner decisions (run in parallel, none blocks the next step)
- [x] **H.1 (owner)** Full e2e run, Profile and Home at 1100 px: owner confirmed ok (Nov 2026). C e2e (`champions palette profile backend`) also ok.
- [x] **H.2 (owner)** Real ADC game checked: matches carry extra item fields (`roleBoundItem` 1200), stored as items, so the boots icon is fine; owner confirmed (Nov 2026).
- [x] **H.3 (owner decision, Riot policy)** Decided: allow-list. Chips: All, Ranked Solo/Duo, Ranked Flex, Normal Draft, ARAM, Arena. No Blind, no Other, no ARAM Mayhem chip (2400 is private in Match-v5, so unusable). "All" shows only these groups, so Brawl, League Classic, Swiftplay, Quickplay and rotating modes are hidden. Done as H.3a below.
- [x] **H.3a** `packages/schema/src/queues.ts`: Blind and Other removed, `queueGroupOf` returns null outside the groups, `matchesQueueFilter("all", id)` is the allow-list; backend `app.ts` hides non-named queues in "All"; stale stored `blind`/`other` falls back to All in Home and Profile; `queues.test.ts`, `app.test.ts`, `profile.spec.ts` updated (api 285, desktop 39 pass; e2e not run here). If Riot ever exposes Mayhem under a usable id, add it as a one-line group.

### B. Match history leftovers (optional, cheap)
- [x] **B.1** Backend: optional `champion` and `role` params on `GET /v1/players/:riotId/matches` (applied after loading, like Arena/Other). Files: `services/api/src/app.ts`, test.
- [x] **B.2a** UI: role chips + champion picker on Profile (`MatchFilterChips` in `MatchRow.tsx`, `matchFilter` in `lib/store.ts`, `MatchFilter` + optional param on `getMatchPage`/`getRecentMatches` in `@apex/schema`, `lib/api/http.ts`, e2e). Note: repo differs from plan: `FilterBar.tsx` is region/patch/rank only, so chips live in `MatchRow.tsx`.
- [x] **B.2b** UI: same chips on Home. Files: `lib/api/index.ts` (`useMatches` takes a `MatchFilter`, in the query key), `app/Home.tsx`, e2e. Champion options on Home: your pool (`usePool(me)`).

### C. One search bar (A.2c is done, unblocked)
- [x] **C.1** Pure matching function (case, space and apostrophe-insensitive: "kaisa", "wukong") with unit tests. Files: new `apps/desktop/src/lib/searchMatch.ts` + test.
- [x] **C.2** Recent searches and favourites store: confirm what `lib/store.ts` already holds; add only what is missing, with tests.
- [x] **C.3** Ctrl+K palette: group "Champions" (icon) using C.1. Files: palette component, `lib/nav.ts`.
- [x] **C.4a** Palette group "Players": favourites + recents (star toggle, Shift+Enter) and a "Look up name#tag" row for a full Riot ID; no Riot calls while typing.
- [x] **C.4b** Backend: `GET /v1/players?q=&limit=` lists players this backend already looked up (read from the local `acct:` cache rows via new `Cache.scan`; no Riot call, q needs 2+ characters). Note: there is no players table; names only exist for Riot IDs looked up through the backend (participants store puuids only).
- [x] **C.4c** Client: `useStoredPlayers` (`lib/api`, debounced 200 ms, 2+ characters, never throws) feeds the palette Players group via `buildPaletteEntries` option `stored`; deduped against favourites/recents.
- [x] **C.5** Palette keyboard and e2e: new `apps/desktop/e2e/palette.spec.ts` (6 tests: arrows/Enter/Esc, champion `LEE sin`, Riot ID lookup + recents, Shift+Enter favourite + reload, stored player, backend offline). Written and parsed but NOT run (no browser in the build environment): owner runs `pnpm --filter desktop test:e2e palette`.
- [x] **C.6a** Removed `SearchBox` (Home 2x, Profile 2x; component deleted). Copy now points to Ctrl+K; Profile keeps its recent-search chips. e2e: `profile.spec.ts` (first test now uses the palette) and `backend.spec.ts` (NA Riot ID lookup via the palette). Decision: LiveGame's "Riot ID to scout" form stays (it scouts a live game at `/live/<id>`, which the palette cannot do) and its spec is untouched.
- [x] **C.6b** Removed the Champions page "Filter champions" field (table keeps role chips and sorting; sorting now copies the list so cached data is not reordered). e2e: `champions.spec.ts` asserts the field is gone and adds a palette test (`lee` opens LeeSin). Block C complete.

### G. Draft rework (owner request Nov 2026, split into single-purpose steps; G.1 first, then in this order)
- [x] **G.1** Import rules: item sets = all builds of the champion and nothing else Apex (older Apex sets deleted, foreign sets untouched); exactly one "Apex: " rune page (overwritten, extras deleted); client writes queued. Files: `lcu-core/src/items.ts`, `runes.ts`, `lib/importer.ts` + tests.
- [x] **G.2** Draft engine math: readable, documented layers (win rate, matchup, synergy, comp balance), shrinkage and confidence in one place, tests. Files: `packages/draft-engine/src/*`.
- [x] **G.3** Clickable draft: click a champion to lock it in / ban it for any slot of the session (client-side what-if state), with undo. Files: `app/Draft.tsx`, `components/ChampionPicker.tsx`, `lib/whatIf.ts`. Backlog: what-if without a running champ select (sandbox with 10 empty slots), Ctrl+Z. REMOVED by the owner (Nov 2026): the what-if layer is gone; replaced by opt-in Hover buttons on suggestions.
- [x] **G.4** Draft data: show each recommendation's build (items, runes, summoner spells) from the same build data as the champion page. Files: `app/Draft*.tsx`, `lib/importer.ts` (read only).
- [x] **G.5** Draft layout rework and cleanup: remove the import log and everything that does not look like a user app; consistent cards, spacing, numbers over text. Files: `app/Draft.tsx` + components, `lib/lcu.ts` (log removal).

### H. Draft: role correctness and pool weighting (owner request Nov 2026: no suggestions for other roles, mastery over recent games; reference: DraftGap)
- [x] **H.1** Pool: champions you only play in another role are left out of ban and pick suggestions (`poolForRole`); your record counts only for games in the role; mastery weighs 0.75 and recent games 0.25 (`familiarity`, `poolZ`, constants in `model.ts`); pool API returns `byRole` and your top 30 mastery champions. Files: `schema`, `services/api/src/app.ts`, `draft-engine/src/{model,personal}.ts`, `app/Draft.tsx` + tests.
- [x] **H.2** Role-keyed draft statistics (DraftGap-style): `store.draftStats` returns lane matchups and champion win rates per ROLE (today pairs are keyed by champion only, so top-lane games of a pair can feed a jungle suggestion); `DraftData.strength/matchup(…, role)`; `createRealData` keys by role with the old role-less lookup as fallback for old data. Files: `services/api/src/store.ts`, `packages/schema`, `draft-engine/src/{engine,real}.ts` + tests; may split again. Done: `draftStats` also returns `roleChampions` + `roleMatchups`; `DraftData.strength/matchup` take an optional role (role strength shrunk toward the champion's overall rate; a pair never seen in the role = 0, no leak); old backends fall back to the role-less numbers. Synergies stay role-less (backlog: per-role pairs).

### I. Pick setup page (owner request Nov 19 2026): Draft opens by itself, a setup page on lock-in, import runes + spells + build
Compliance (`docs/COMPLIANCE.md` row 3): writes only your rune page, spells and item sets, auto-import stays OFF by default, no input injection.
- [x] **I.1** Draft page opens when champ select starts (`autoOpenDraft`, on by default, Settings toggle, fires once per draft). Files: `lib/nav.ts` (`shouldOpenDraft`), `store.ts`, `Shell.tsx`, `Settings.tsx`, tests.
- [x] **I.2** Pure selection model `lib/pickSetup.ts` (`PickSetup {variantId?, runePage?, spellPair?}`, `resolveSetup`: defaults gated by `MIN_BUILD_GAMES`, an explicit choice is always honoured, bad indexes fall back); `importRunes`, `importSpells` and `runImport` take an optional `PickSetup`. Item sets still write every build type (all variants), not only the chosen one: I.3 decides if that should change.
- [x] **I.3a** Setup page `/draft/setup/:id/:role?` (`app/PickSetup.tsx`, id = Data Dragon id): build-type, rune-page and spell-pair pickers using `resolveSetup`, Import button (`runImport(key, role, sel)`, desktop + connected only). `DraftBuild.tsx` now exports `Wr` and `RuneIcons`. Item sets still write every build type. Not linked from anywhere yet.
- [x] **I.3b** Setup page opens on lock-in: pure `setupPathOnLock` (`lib/nav.ts`), effect in `Shell.tsx`; only from the Draft page itself (never moves you off another screen), once per lock-in, not in the compact window; own setting `autoOpenSetup` (on by default, Settings toggle). e2e `draft.spec.ts`: lock-in opens the page, back to Draft stays; the other draft tests switch the setting off. Repo vs plan: no spell-pair pick in the e2e (build data of the test backend not confirmed); Import is desktop-only so not in e2e.
- [x] **I.4** Import state on the setup page: `useDraft.imported` (champion key an import last wrote; set by `runImport` when a step wrote something (`wroteAnything`), cleared when a new draft starts); the page shows an "Imported" badge and the button reads "Import again"; a changed pick is only written on the next click. Auto-import on lock-in already imported the defaults (unchanged, still OFF by default). e2e only checks that the browser never claims an import (it cannot write): a real "Imported" e2e needs F.1.
- [x] **I.5** (owner request Nov 20 2026) Setup page = the champion-page build (`BuildPanel` with `pick`: full rune pages, spells, items, skill order; build type, rune page and spell pair are clickable and lit = written), every click auto-imports during champ select (I.6: at once, only what changed) (button stays as "Import again"); when the game starts the setup page gives way to `/draft`, whose tab follows the client to "Live game" (`liveTabOnGameStart`). `docs/COMPLIANCE.md` row 3 updated. e2e: game start opens the live tab. Not tested: the auto-import itself (Tauri only, needs F.1).
- [x] **I.6** (owner: clicking felt slow) Click imports are immediate (no 500 ms pause), write only what changed (`changedSteps`: rune click = runes, spell click = spells, build type = both), reuse the build already on screen (no re-fetch), skip the item sets after the first import (they do not depend on the choice), and have no success toast (the "Imported" badge shows it). Fast clicks merge into one follow-up write with the latest choice. `runImport(key, role, sel, { build, only, quiet })`. Needs a check in the real desktop app.
- [x] **I.7** (owner request Nov 20 2026) The setup (build) page keeps the draft context: next to or above the build chooser it still shows almost everything of the Champ select page except the picking: both teams with their picked and banned champions, the win-probability bar (with its games count), team composition, and the win rates of the champions and matchups (the same data and components as the Draft page). NOT shown on it: ban and pick suggestions, pool checkbox, import toggles, click-suggestion buttons. Reuse, do not copy: pull the shared parts out of `Draft.tsx` into components both pages use (read `Draft.tsx` first and list which panels exist). Layout: build chooser stays the main column, draft context beside it on wide windows, below on narrow ones. Split it (e.g. I.7a extract shared panels, I.7b place them on the setup page). Desktop app only, no mock work.

### D. Overlay (Rust involved; unverified until run on the owner's machine)
- [x] **D.1** Overlay card content: runes and summoner spells removed; skill order, starting items, build order kept; boots follow the champion-page rule (already did). File: `app/Overlay.tsx`.
- [x] **D.2** Pure position-clamping function (per monitor, scale factor, fallback to primary top-left if the saved monitor is gone) with tests. File: `packages/lcu-core/src/overlay.ts` + test.
- [x] **D.3** Settings store: `overlayPositions` (per monitor id, logical px) + `overlayMonitor`, `setOverlayPosition`/`resetOverlayPosition`, version 2, `migrateUi(old, version)` (the v1 cleanup only runs for stores older than 1), tests in `lib/store.test.ts`. File: `lib/store.ts`.
- [x] **D.4 (done, unverified on a real game; see STATUS)** Rust + overlay UI: the overlay is draggable AT ANY TIME during a game, no setting and no move mode (owner request Nov 2026): hold the left mouse button on the card and move it anywhere on screen (Tauri `startDragging()` on mousedown). Only the card area takes the mouse; the rest of the screen stays click-through (window sized to the card, click-through switched by whether the cursor is over the card, polled in Rust; check the window does not take keyboard focus, e.g. no-activate, so the game keeps focus). On release the spot is clamped with `clampOverlayPosition` (monitors listed from Rust) and saved with `setOverlayPosition`. Sends no input to the game. Files: `src-tauri/src/overlay.rs`, `lib.rs`, `capabilities/overlay.json`, `app/Overlay.tsx`. Unverified until run on the owner machine (needs borderless/windowed game).
- [x] **D.5 (done)** Settings UI: only the corner presets and a "Reset position" button (no "Move overlay" mode: dragging works in game); fix the overlay hint text, it still lists runes and says nothing about dragging. File: `app/Settings.tsx`.
- [x] **D.7** (owner request Nov 2026) Overlay: bottom caption removed; start items hide 45 s after the overlay appears (`startItemsLeftMs`, plain timer). CLOSED: owner says the current timing is enough, no change. Exact "from game start" and "hide when bought" need Live Client Data (P3, compliance re-check first) and are not planned.
- [x] **D.6** `docs/COMPLIANCE.md`: overlay is still a static pre-game card; it is always click-through; on Windows a low-level mouse hook takes (swallows) only a LEFT-button press that starts on the card and moves the window with the cursor; right/middle clicks, hover and everything else pass to the game untouched; the hook reads button and cursor position and never sends input; no input to the game, no game state read; also fix the line saying it is fully click-through.

### F. Import test seam
- [x] **F.1** DROPPED (owner, Nov 20 2026): no more mock LCU or test-seam work; everything is built for and checked in the desktop app. (Was: inject `lcu()` into `lib/importer.ts` and add an item-set endpoint to the mock LCU.)

### E. Phase 2 remainder (each is a spec/verify first, then code)
- [x] **E.1 (spec, docs only)** DONE: `docs/DRAFT_TAGS.md`. Choose a real source for draft layer B tags (engage, peel, poke, scaling, waveclear). Output: short note in `docs/` and a revised E.2. No guessing from class tags.
- [x] **E.2** (audit Nov 20 2026: ranked picks EXIST (top 6 by win probability for your role, delta, reason, pool note) but show no sample size / LOW DATA per row = FIXED E.2b (games + LOW DATA per row); win-probability bar EXISTS (animated, band, source, top factors, labelled heuristic) = OK; pool overlay EXISTS (toggle, role-cut pool, "You:" note, ban weighting), toggle was silent without Riot ID or pool = FIXED E.2a; auto-accept stays unbuilt (compliance), hover/lock/ban buttons exist) Verify and finish the Draft UI items marked "?" in 6.1 (ranked picks, win-probability bar, personal pool overlay): list what exists, fix gaps one per step.
- [x] **E.2c to E.2f (revised E.2, see `docs/DRAFT_TAGS.md`)** E.2c scaling data (win rate by game length) DONE, E.2d scaling in model + UI DONE, E.2e peel data (heals/shields on teammates, new columns) DONE, E.2f peel in team comp + UI DONE. Engage and Waveclear deferred, Poke dropped.
- [x] **P.1 to P.2 (profile overview, owner request Nov 20 2026, modelled on OP.GG / DPM.lol)** P.1 Champion performance + Role performance from the latest 20 games of the chosen queue: sidebar on windows 1600 px and wider, an Overview tab on narrower ones (`ProfileSidebar.tsx`, `lib/profileStats.ts`) DONE. P.2 DONE without pings (dropped by the owner: Riot ping art not allowed). Window is now the latest 50 games (client pages by 20). P.2 Played with (teammates seen in 2+ of those games, linking to their profiles): a backend `/v1/players/:riotId/overview` over the cached matches, schema + API client, two more panels. Backlog: season-long stats need stored history, not just the latest 20 games.
- [x] **E.3** Ban recommendation function (pure, tested) in `packages/draft-engine`. ALREADY DONE (found Nov 20 2026): `recommendBans` in `personal.ts` (pool-weighted, tested in `personal.test.ts`).
- [x] **E.4** Ban panel in the Draft screen using E.3. ALREADY DONE: `Draft.tsx` + `BanSuggestions` in `DraftPanels.tsx`, ban phase only (owner request 2).
- [x] **E.5** API: lane diffs (gold/CS/XP at 10/15/20) per matchup from timeline games. DONE Nov 20 2026: new nullable `participants.lane`, `extractTimeline` reads `participantFrames`, `store.laneDiffs`, optional `RelationLine.lane` on matchups (`LaneDiff[]`). Games stored before this have no lane data until re-fetched.
- [x] **E.6** UI: lane-diff columns in the matchup table. DONE Nov 20 2026 (file is `apps/desktop/src/app/RelationsPanel.tsx`, not `components/`): Gold/CS/XP switch, 10/15/20 min columns, pure `lib/laneDiff.ts`.
- [x] **E.7** API: per-game performance grade vs your own average and rank average. DONE Nov 20 2026: `PostGameRecap.grade` (`vsRank`, `vsYou`: `GameGrade` score 0..100, letter S/A/B/C/D, games, low, measures), pure `services/api/src/grade.ts`.
- [x] **E.8** UI: grade on the Recap screen. DONE Nov 20 2026: the Recap already had one client-side grade (repo vs plan); it now shows rank AND own-games grades with games and LOW DATA (`lib/recapGrade.ts`), and the backend grade (E.7) uses the same stats-core `performanceScore`/`perfGrade` scale.
- [x] **E.9** Patch changes tab: link to the official patch notes. DONE Nov 20 2026: URL pattern verified against Riot's pages for 26.12/26.16/26.21/26.22 (`lib/patchNotes.ts`), `components/ExternalLink.tsx` (new tab + Copy link). Backlog: `tauri-plugin-opener` so links open the system browser for sure (Rust, Cargo.toml, capability, lockfiles: needs owner OK).
- [x] **E.10** Overlay works when Apex starts mid-game: read the locked champion from the gameflow session (Rust + `lcu-core`).
- [x] **E.11** Overlay hotkey via the global-shortcut plugin. DROPPED (owner decision Nov 20 2026): did not work with the game focused; removed again, no replacement button.

### R. Skill radar (first P3 item, split Nov 20 2026; the per-game performance score is already done as E.7/E.8)
- [x] **R.1** Pure `skillRadar` in `packages/stats-core/src/radar.ts` (+ `radar.test.ts`, 8 tests): five axes (fighting = KDA, farming = CS/min, damage/min, economy = gold/min, vision/min) from a player's games vs a caller-supplied reference, scored 0..100 with the shared `performanceScore`/`perfGrade` scale; totals over totals; LOW DATA under 10 games; no overall under 3 axes. DONE Nov 20 2026.
- [x] **R.2a** API (split from R.2, Nov 20 2026): `GET /v1/players/:riotId/radar?queue=&role=` (`services/api/src/radar.ts`, route in `app.ts`, `store.radarReference`, schema `PlayerRadar`, 12 tests in `radar.test.ts`). The player's latest 50 games in one role (default most played) vs the collected Ranked Solo average of that role (own rank tier with 30+ games, else all ranks; totals over totals). The collector stores no vision score, so the vision axis has no reference and is skipped. DONE Nov 20 2026. The match loader of `/overview` is now the shared `latestGames` helper.
- [x] **R.2b** Client: `ApexApi.getRadar(riotId, queue?, role?)` in `packages/schema` + `lib/api/http.ts`, `useRadar` in `lib/api/index.ts` (copy `getOverview`/`useOverview`), a unit test for the query params.
  - Backlog (one line): store `visionScore` in `participants` (collector, new column) so the vision axis gets a rank reference.
- [x] **R.3** DONE Nov 20 2026 (`components/SkillRadar.tsx`, `RadarPanel` in `ProfileSidebar.tsx`, pure geometry `lib/radarChart.ts` + 7 tests; role chips, LOW DATA chip, empty states for no reference / under 3 axes; not verified in the real app). UI: radar chart (SVG, drawn-in, reduce-motion aware, axis values in tooltips with sr-only text) on the Profile overview, LOW DATA chip, wording says "compared with the rank average, not who deserved to win". Strengths/weaknesses text (best/worst axis with evidence) is a later step.
- [x] **R.4** DONE Nov 20 2026 (`lib/radarInsight.ts` + 6 tests, rows in `SkillRadar.tsx`). Strengths and weaknesses on the radar panel: pure `radarInsights(radar)` in `apps/desktop/src/lib/radarInsight.ts` (+ test) from `best`/`worst`: a strength only if its score is 5+ above 50, a weakness only if 5+ below; shows axis, value vs rank average, % difference, games; nothing under LOW DATA, without a reference or with under 3 axes. Wording stays "compared with the average".

- [x] **P3.1** DONE Nov 20 2026 (split from "champion pool analysis"): pure `poolInsight` in `apps/desktop/src/lib/poolInsight.ts` (+ tests) from `usePool` (latest 20 games of any queue + mastery): shape (focused / balanced / wide by top-3 share), one-trick (6+ games and 50%+), dusty mastery (20k+ points, no recent game); null under 10 games. Shown as `PoolChips` at the top of Champion performance in `ProfileSidebar.tsx` (no separate panel: the sidebar was crowded). Not verified in the real app. Later P3.x ideas: per-role pool (`byRole`), comfort picks, pool win rates over a longer window / queue-aware pool endpoint.
- [x] **P3.2** DONE Nov 20 2026 (split from "win rate by length and advanced filters"): `GET /v1/champions/:id/lengths` (`services/api/src/app.ts`, `store.championLengths`, `LENGTH_CURVE_SEC` 20/25/30/35 min -> 5 buckets, counts only, patch/region/rank filters, role default = busiest), schema `ChampionLengths`/`LengthBucket`, pure `lengthCurve` in `packages/stats-core/src/lengthCurve.ts` (shrunk toward the champion's own overall rate, Wilson, badge; 4 tests). Not verified against real data.
- [x] **P3.3** DONE Nov 20 2026: client `getChampionLengths` (schema `ApiClient`, `http.ts`, `useChampionLengths`), `app/LengthPanel.tsx` on the champion page above Patch history (zoomed curve + table, sample sizes, low-data badge, correlation tooltip), pure `lib/lengthAxis.ts` (3 tests). Real Ahri MID data: flat curve (47.6% under 20 min, 50-52% elsewhere). Not verified in the real app.
- [x] **P3.3b** DONE Nov 20 2026 (owner request after seeing P3.3): Patch history and game length merged into one `app/HistoryPanel.tsx` (patch left, length right, one shared role switch, stacks below `xl`); changes now sit in the value cell as small grey brackets via `InlineDelta` (`components/Delta.tsx`), so the patch table has 5 columns instead of 7. `PatchPanel` / `LengthPanel` take `role` and render only their body. Not verified in the real app; e2e (`champions.spec.ts` patch test, unchanged) not run.
- [ ] **P3.4** NEXT: pick from advanced filters (queue-agnostic / rank-tier groups) or duo detection; split into one line first.

- [x] **RC** DONE Nov 20 2026 (RC.3: `lib/useApexRing.ts`, `Home.tsx`, `Profile.tsx`; not verified in the real app or against real Riot cut-offs). Master+ LP ring as progress to the next cut-off (split Nov 20 2026; replaces the full gold ring from `lpRing`). **RC.1** DONE: `GET /v1/ladder/:platform/cutoffs` (`cutoffs.ts`, `riot.apexLeague`, schema `ApexCutoffs`, 1 h cache, 6 tests): lowest LP in the Grandmaster and Challenger lists. **RC.2** DONE Nov 20 2026 (`apexRing` + 8 tests in `lpRing.ts`, `useCutoffs`, `getCutoffs` + http test; gold ring stroke 4 instead of 6): client: `getCutoffs` in `packages/schema` + `http.ts`, `useCutoffs(platform)` in `lib/api/index.ts`, `apexRing(tier, lp, cutoffs)` in `lib/lpRing.ts` (Master: LP / GM cut-off; Grandmaster: (LP - GM cut-off) / (Challenger cut-off - GM cut-off); Challenger: full ring, LP above the cut-off; fall back to the full gold ring when a cut-off is missing). **RC.4** DONE Nov 20 2026 (seat-based cut-offs, see STATUS): the lowest LP of Riot's lists sat below the real cut-off (NA 1887 vs about 1982) because the lists are re-cut once a day; `apexCutoffs` now pools Master + Grandmaster + Challenger by LP and reads the last Challenger / Grandmaster seat (`APEX_SEATS`, from Riot support), falling back to the list minimum. **RC.3** DONE: UI in `Home.tsx` / `Profile.tsx`: ring + one line ("142 LP to Grandmaster"), wording that cut-offs are today's and Riot updates tiers on its own schedule. Not verified against real Riot data.
- [ ] **L** Ladder tab (owner request Nov 21 2026; split into three steps). Master+ ladder per region: filters Solo/Duo or Flex, Challenger / Grandmaster / Master, region; rows = rank, name, LP, top 3 champion icons side by side, win rate % with W/L (maybe a small bar); every row links to the player's profile. **L.1** DONE Nov 21 2026 (backend, not run against real Riot): `GET /v1/ladder/:platform?queue&tier&offset&limit` and `GET /v1/ladder/:platform/players/:puuid` (`ladder.ts`, `riot.accountByPuuid`, `apexLeague` takes a queue, schema `LadderPage/LadderRow/LadderPlayer`, 5 tests). **L.2** client layer: `getLadder` / `getLadderPlayer` in schema `ApexApi` + `http.ts` (+ test), `useLadder` / `useLadderPlayer` in `lib/api/index.ts`. **L.3** the page: `Ladder.tsx`, route, sidebar entry, filters, rows (lazy per-row name and champions, paging).

### P3 and later (split into single-purpose steps only when one becomes NEXT)
Skill radar: see R above; strengths/weaknesses insights; champion pool analysis; ML draft model (layers C and D); win rate by length and advanced filters; ARAM/Arena collection and stats; duo detection; notifications; patch notes reader; friends list; local player notes. Then P4 (pro data, leaderboards, sharing, localization, AI coaching, sync, smurf estimate) and P5 (plugins, duo board, mobile, web).

## 9. Riot compliance guardrails (PDF section 12, condensed; repo detail in `docs/COMPLIANCE.md`)
1. Register the product, use a production key when available, follow the Developer Policies, show the required legal disclaimer ("isn't endorsed by Riot Games...").
2. **No hidden information.** Overlay only uses data the game exposes to the player. No automatic enemy cooldown tracking, no fog-of-war info. Manual click timers are fine.
3. **No gameplay automation or input injection.** LCU auto-accept and auto-import only as optional, default OFF, reviewed against current policy.
4. No harassment or doxxing: notes stay local; smurf score labelled as an estimate; no MMR estimates.
5. Monetization must comply with Riot's rules on charging for stats products (decide before any paid feature).
6. Data Dragon / Community Dragon asset rules; own rank emblems and role glyphs (Riot's are not allowed).
7. Repo specifics: Brawl and League Classic data not aggregated or shown; no names in ranked champ select; no power-spike alerts.

## 10. Quality, security, performance
- Tests: stats-core (Wilson, Bayes) with golden values; LCU event handling against the mock; collector (rate limit, rank filter); API contract via `@apex/schema`; Playwright e2e for UI.
- Budgets: cold start under 2 s, tab switch under 100 ms, draft eval under 150 ms, overlay CPU/GPU negligible.
- Security: Riot key only in `services/api/.env` and on the backend; opt-in telemetry; graceful offline mode; signed installers/updates later.
- Accessibility: keyboard navigation, screen-reader labels, colorblind-safe palette, reduce-motion setting.

## 11. Open decisions, risks and known limits
- Decide personal vs commercial (monetization rules) and business model before any paid feature.
- Riot key: dev key allows about 3 games/s in total; only a production key raises collection speed.
- Risks: LCU or overlay changes after patches (keep the adapter layer in `lcu-core`); policy violations (check section 9 before building); biased stats (shrinkage, intervals, transparency); scope creep (one step per turn).
- Known limits (details via `grep` in `docs/STATUS_ARCHIVE.md`, section 6): data fills in over time (rune pages, damage profiles and timelines only for newly collected games); variants need 10+ games; LP history only from Apex lookups; overlay is one of four corners, needs Borderless mode, build fetched once at lock-in.

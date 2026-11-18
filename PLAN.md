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
| Builds: starting items, boots, build order, core, situational, support item, variants (AP/AD/Tank) | P2 | ✅ |
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
| Performance score per game/champion (normalized by role, rank, patch) | P2 | ⬜ |
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
- [ ] **B.1** Backend: optional `champion` and `role` params on `GET /v1/players/:riotId/matches` (applied after loading, like Arena/Other). Files: `services/api/src/app.ts`, test.
- [ ] **B.2** UI: champion and role filter chips on Profile (shared with Home). Files: `components/FilterBar.tsx` or `MatchRow.tsx`, `lib/store.ts`, e2e.

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

### D. Overlay (Rust involved; unverified until run on the owner's machine)
- [ ] **D.1 (NEXT)** Overlay card content: remove runes and summoner spells, keep skill order, starting items, build order; boots follow the champion-page rule. File: `app/Overlay.tsx`.
- [ ] **D.2** Pure position-clamping function (per monitor, scale factor, fallback to primary top-left if the saved monitor is gone) with tests. File: `packages/lcu-core/src/overlay.ts` + test.
- [ ] **D.3** Settings store: saved free position per monitor, version bump and migration. File: `lib/store.ts`.
- [ ] **D.4** Rust: "move mode" window commands (not click-through while moving, visible frame, leave move mode on game-phase change). Files: `src-tauri/src/overlay.rs`, `lib.rs`, `capabilities/overlay.json`.
- [ ] **D.5** Settings UI: "Move overlay" mode, corner presets, "Reset position". File: `app/Settings.tsx`.
- [ ] **D.6** One line in `docs/COMPLIANCE.md`: overlay is still a static pre-game card.

### F. Import test seam
- [ ] **F.1** Inject `lcu()` into `lib/importer.ts` and add an item-set endpoint to the mock LCU, so import is testable without Tauri. Files: `importer.ts`, `packages/lcu-mock/src/server.ts`, test.

### E. Phase 2 remainder (each is a spec/verify first, then code)
- [ ] **E.1 (spec, docs only)** Choose a real source for draft layer B tags (engage, peel, poke, scaling, waveclear). Output: short note in `docs/` and a revised E.2. No guessing from class tags.
- [ ] **E.2** Verify and finish the Draft UI items marked "?" in 6.1 (ranked picks, win-probability bar, personal pool overlay): list what exists, fix gaps one per step.
- [ ] **E.3** Ban recommendation function (pure, tested) in `packages/draft-engine`.
- [ ] **E.4** Ban panel in the Draft screen using E.3.
- [ ] **E.5** API: lane diffs (gold/CS/XP at 10/15/20) per matchup from timeline games. Files: `services/api/src/*`, test.
- [ ] **E.6** UI: lane-diff columns in the matchup table (`RelationsPanel.tsx`).
- [ ] **E.7** API: per-game performance grade vs your own average and rank average. Files: `services/api/src/*`, test.
- [ ] **E.8** UI: grade on the Recap screen.
- [ ] **E.9** Patch changes tab: link to the official patch notes (check Riot's current URL pattern, do not hard-code from memory).
- [ ] **E.10** Overlay works when Apex starts mid-game: read the locked champion from the gameflow session (Rust + `lcu-core`).
- [ ] **E.11** Overlay hotkey via the global-shortcut plugin.

### P3 and later (split into single-purpose steps only when one becomes NEXT)
Performance score and skill radar; strengths/weaknesses insights; champion pool analysis; ML draft model (layers C and D); win rate by length and advanced filters; ARAM/Arena collection and stats; duo detection; notifications; patch notes reader; friends list; local player notes. Then P4 (pro data, leaderboards, sharing, localization, AI coaching, sync, smurf estimate) and P5 (plugins, duo board, mobile, web).

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

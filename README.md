# Apex (Phase 1: Core Desktop MVP)

Desktop League of Legends companion built with Tauri 2, React, TypeScript, Vite, Tailwind, Zustand and TanStack Query.
All data comes from the local backend (`services/api`) behind one typed interface (`packages/schema` `ApexApi`). There is no sample
data in the app: until games are collected, screens say so. No API key is ever stored in the client.

## Run
```
pnpm install
pnpm test                 # stats-core (25) + draft-engine (25) + lcu-core (23)
pnpm dev                  # UI in the browser, http://localhost:1420
pnpm lcu-mock             # fake League client (second terminal), then open Draft
pnpm tauri dev            # native window (first run compiles Rust)
pnpm build                # type-check + production web build
pnpm --filter desktop exec playwright install chromium   # once
pnpm --filter desktop test:e2e                            # end-to-end tests (start the app, the mock League client and a fake-Riot backend themselves)
```
Prerequisites: Node 20+, pnpm, Rust (MSVC), Visual Studio C++ Build Tools, WebView2.

Tests: unit tests for the maths and logic (`pnpm test`) and end-to-end browser tests for screens and flows
(`apps/desktop/e2e`, Data Dragon faked so they work offline). CI runs both (`.github/workflows/ci.yml`).

## Layout
- `apps/desktop/src` React UI: `app/` screens and shell, `components/` design system, `lib/` api, stores, Data Dragon, LCU transport.
- `apps/desktop/src-tauri/src` Rust: `lcu.rs` (real League client connector), `overlay.rs` (overlay window).
- `packages/schema` shared types and the `ApexApi` contract. `packages/stats-core` Wilson, shrinkage, z-score (tested).
- `packages/lcu-core` champ select reducer, event parsing, import trigger (tested). `packages/lcu-mock` mock League client. `packages/draft-engine` win probability + recommendations behind a `DraftData` interface (tested; fed by collected games).

## Status
| Area | State |
|---|---|
| Shell, design system, themes, command palette, compact mode | Built |
| Home, Profile + match detail, Champions + champion page, Draft, Settings | Built (collected and live Riot data) |
| Mock LCU, real LCU connector (Rust) | Built; real connector needs testing on your machine |
| Overlay window (transparent, on top, click-through) | Groundwork; placeholder content |
| Tier List (per-role grades S+ to D, Bayesian-adjusted, low-data champions hidden) | Built (collected data) |
| Live Game scouting (Spectator-v5: all 10 players, rank, season record, champion win rate, bans, 30 s refresh) | Built (needs a Riot key and a game in progress) |
| Post-game recap (latest or chosen game vs collected rank averages, your own games and the lobby; grade S-D) | Built (the rank baseline needs enough collected games) |
| Real rune import (placeholder runes by champion class) | Built; needs testing on your machine |
| Summoner spell import (placeholder by role) | Built; needs testing on your machine |
| Item set import | Deferred to Phase 2 (needs real build data) |
| Draft engine (layers A+B+D), win-probability bar, pick and ban suggestions | Built on SYNTHETIC data (packages/draft-engine) |
| Backend, real stats, ML draft model, personalization | Phase 2 (next) |

## Performance budgets (plan section 7)
Screens are code-split and preloaded on nav hover. In dev, the browser console logs `[perf]` lines: first render
(budget 2000 ms) and approximate tab-switch time (budget 100 ms, warns when exceeded). Draft evaluation (150 ms) arrives with the engine.

## Accessibility
Skip link, labelled landmarks, `aria-current` nav, `aria-pressed` chips, labelled switches and sliders, focus rings,
focus returns after the command palette, page title and a polite live region announce navigation. Reduce motion
(Settings or OS) disables transforms, number counters, ring draws and CSS transitions. Colorblind-safe theme included.

See `docs/COMPLIANCE.md` for the Riot policy checklist.

## Real data (local backend)
`services/api` is a small Node service that talks to Riot with your API key and caches results in a local SQLite file.
The app never sees the key. It listens on 127.0.0.1 only (this laptop).
```
copy services\api\.env.example services\api\.env     # then edit .env: set RIOT_API_KEY and RIOT_PLATFORM
pnpm api                                              # terminal 1: starts on http://127.0.0.1:8787
pnpm tauri dev                                        # terminal 2; set your Riot ID in Settings
```
Works with real data now: rank, match history, match detail, mastery, and champion statistics (win/pick/ban rates, items, keystone runes, matchups)
from the data collector, and the draft engine's numbers. Not available yet (they say so instead of showing made-up data): LP history, skill orders.

### Filters (region, patch, rank)
Every stats screen shares one filter bar. Every region (17), every patch seen, and every rank is always offered, so filtering is instant;
options the collector has not filled in yet say "no data yet". Ranks are cumulative everywhere: **Emerald+ means Emerald IV and everything
above it** (there is no "exactly Emerald"); "All ranks" is Iron and up.

### Data collector
Starts by itself with `pnpm api` and covers every region and every rank (all ladders: region x tier x division), with 16 parallel
workers at low priority (80% of each region's rate limit, which Riot enforces per region; set `COLLECT_SHARE` to change). Workers are spread over the four Riot clusters so every limit stays in use. A development key caps this at roughly 3 games per second in total. Pause or resume it in Settings. Optional
`.env` settings: `COLLECT_DISABLED=1`, `COLLECT_CONCURRENCY`, `COLLECT_SHARE`, `COLLECT_PAGES`, `COLLECT_ONLY_PLATFORMS`, `COLLECT_ONLY_TIERS`. The service reads the key's real
rate limits from Riot's responses, so a production key runs faster automatically.

### Players and drafts
Searching a Riot ID needs no region: the backend finds where the player plays (from the region prefix of a recent match id).
The Draft screen uses the collected matchups and synergies for the current filters, and your own recent champion pool, once the collector has games.

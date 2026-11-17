# Apex

Desktop League of Legends companion built with Tauri 2, React, TypeScript, Vite, Tailwind, Zustand and TanStack Query.
Every screen shows real data from the local backend (`services/api`), which talks to Riot with your API key and stores
collected games in a local SQLite file. The app never sees the key.

## Run
```
pnpm install
copy services\api\.env.example services\api\.env     # then edit .env: set RIOT_API_KEY and RIOT_PLATFORM
pnpm api                                              # terminal 1: backend on http://127.0.0.1:8787
pnpm tauri dev                                        # terminal 2: native window (first run compiles Rust)
```
Then open Settings and enter your Riot ID. Prerequisites: Node 20+, pnpm, Rust (MSVC), Visual Studio C++ Build Tools, WebView2.

## Develop and test
```
pnpm dev                  # UI in the browser, http://localhost:1420 (needs pnpm api running)
pnpm test                 # unit tests: stats-core, draft-engine, lcu-core, api
pnpm build                # type-check + production web build
pnpm --filter desktop exec playwright install chromium   # once
pnpm --filter desktop test:e2e                            # end-to-end tests (start everything they need themselves)
```
Test-only tooling, never shown in the app:
- `services/api/src/fake-server.ts` is the real API with a fake Riot behind it (port 8788). The e2e tests use it, so they need no key or internet.
- `packages/lcu-mock` is a League client simulator. In the browser dev preview (`pnpm dev`, not the native window) the Draft screen connects to it
  automatically. Run `pnpm lcu-mock`, then start a champ select from another terminal:
  `curl -X POST http://127.0.0.1:8765/scenario/normal` (also `dodge` and `reset`).

## Layout
- `apps/desktop/src` React UI: `app/` screens and shell, `components/` design system, `lib/` api client, stores, Data Dragon, LCU transport.
- `apps/desktop/src-tauri/src` Rust: `lcu.rs` (League client connector), `overlay.rs` (overlay window groundwork).
- `services/api` local backend: Riot client with rate limiter, data collector, stats, live game, recap.
- `packages/schema` shared types and the `ApexApi` contract. `packages/stats-core` Wilson, shrinkage, z-score, tier grades.
- `packages/lcu-core` champ select reducer, event parsing, import trigger. `packages/draft-engine` win probability and recommendations from collected games.

## What works
| Area | State |
|---|---|
| Shell, design system, themes, command palette, compact mode | Built |
| Home, Profile + match detail + mastery, Champions + champion page, Tier List, Live Game, Post-game recap | Built, real data |
| Draft assistant (win probability, pick and ban suggestions, your champion pool) | Built; needs collected games for the current filters |
| League client connector (Rust) | Built; needs the real client running |
| Rune, summoner spell and item set import | Built; uses collected games (10+ per champion), class/role defaults otherwise. Needs testing against the real client |
| Champion page "Matchups and synergy" (lane matchups and teammates, difference from the expected win rate) | Built; needs collected games (pairs with 5+) |
| Champion page "Recommended build" | Built (runes, spells, skill order, starting items, build order, final items; sample sizes shown) |
| Item WPA (win probability added: item owners vs comparable games without it, shrunk, with 95% range) | Built (champion page Items table and Recommended build); a correlation within games of the same length and item count, labelled as such |
| Skill order, starting items, build order | Built from a sample of games with timelines (`COLLECT_TIMELINES`), fills in as games are collected |
| LP history (Profile tab) | Built. Apex records your rank each time it looks you up, so history starts when you first open it and changes are totals between checks |
| In-game overlay | Window groundwork only, not reachable from the UI |

## Performance budgets (plan section 7)
Screens are code-split and preloaded on nav hover. In dev, the browser console logs `[perf]` lines: first render
(budget 2000 ms), approximate tab-switch time (budget 100 ms), and draft evaluation (budget 150 ms).

## Accessibility
Skip link, labelled landmarks, `aria-current` nav, `aria-pressed` chips, labelled switches and sliders, focus rings,
focus returns after the command palette, page title and a polite live region announce navigation. Reduce motion
(Settings or OS) disables transforms, number counters, ring draws and CSS transitions. Colorblind-safe theme included.

See `docs/COMPLIANCE.md` for the Riot policy checklist.

## Backend details
The backend listens on 127.0.0.1 only. Rank, match history, match detail, mastery and champion statistics (win/pick/ban rates, items, keystone runes, matchups) all come from Riot and the data collector.

### Filters (region, patch, rank)
Every stats screen shares one filter bar. Every region (17) and every rank is always offered, so filtering is instant; the patch menu lists the 5 newest patches that have data (plus "Latest patch" and "Last 5 patches", which combines them);
options the collector has not filled in yet say "no data yet". Ranks are cumulative everywhere: **Emerald+ means Emerald IV and everything
above it** (there is no "exactly Emerald"); "All ranks" is Iron and up.

### Data collector
Starts by itself with `pnpm api` and covers every region and every rank (all ladders: region x tier x division), with 16 parallel
workers at low priority (80% of each region's rate limit, which Riot enforces per region; set `COLLECT_SHARE` to change). Workers are spread over the four Riot clusters so every limit stays in use. A development key caps this at roughly 3 games per second in total. Pause or resume it in Settings. Optional
`.env` settings: `COLLECT_DISABLED=1`, `COLLECT_CONCURRENCY`, `COLLECT_SHARE`, `COLLECT_PAGES`, `COLLECT_TIMELINES`, `COLLECT_ONLY_PLATFORMS`, `COLLECT_ONLY_TIERS`. The service reads the key's real
rate limits from Riot's responses, so a production key runs faster automatically.

### Patch retention (last 5 patches)
Apex keeps, collects and shows only the 5 newest patches. The newest patch is the highest one seen in the collected games (compared numerically, so 16.10 is newer than 16.9), never decided by the clock. Games of older patches are refused by the collector, and
the games of the patch that falls out of the window (with their players, runes, timelines and bans) are deleted when the first game of a new patch arrives and again on every start of `pnpm api`. LP history is not patch data and is never deleted.
"All patches" no longer exists: the "Last 5 patches" option is the widest view.

### Players and drafts
Searching a Riot ID needs no region: the backend finds where the player plays (from the region prefix of a recent match id).
The Draft screen uses the collected matchups and synergies for the current filters, and your own recent champion pool, once the collector has games.

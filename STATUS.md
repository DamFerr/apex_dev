# STATUS

## Current State
- Phase 1 complete, Phase 2 mostly done: Tauri 2 + React/TS desktop app, every screen on real data from the local Fastify + SQLite backend (`services/api`); LCU connector + mock LCU, draft engine, champion page (build types), tier list, live game, recap, overlay v1, draft import, Ctrl+K palette.
- **Last work: E.1 done** (docs only: `docs/DRAFT_TAGS.md`; scaling then peel get a measured source, engage and waveclear deferred, poke dropped; E.2 revised into E.2c to E.2f in `PLAN.md`). Also: "Open setup" button on the Draft page (shown once you are locked in) to get back to the build page after leaving it. Before: **E.2b** (each suggested pick shows its collected games in your role and a LOW DATA badge under 50: optional `DraftData.games`, `Recommendation.games` in `packages/draft-engine`, `createRealData` fills it, `Recommendations` shows it; 2 new engine tests). Before: **E.2a** (audit in `PLAN.md` E.2 line; the "Use my champion pool" toggle on the Draft page is now disabled with the reason as tooltip when there is no Riot ID or the pool is loading or failed, instead of silently doing nothing). Before: I.7 done, plus fixes. Live game now: no "you" pill (gold border + sr-only text), caps chips (LOW DATA everywhere, HOT STREAK, LIVE), JUNGLER chip removed, estimated role icon per player (`lib/liveRoles.ts`, Summoner's Rift only), keystone + secondary tree icons for all ten players (owner decision Nov 20: `ActiveParticipant.perks` in `riot.ts` -> `keystone`/`secondaryStyle` on `LivePlayer` in `packages/schema` via `toLiveGame`; `COMPLIANCE.md` row 2 updated). Before that: I.7 draft context on the setup page (`DraftContext.tsx`), dodge returns from the setup page (`leaveSetupOnChampSelectEnd`), expandable build under suggested picks removed (`DraftBuild.tsx` deleted).
- The mock locks your pick ~20 s into a draft, so in `draft.spec.ts` the helper `open()` switches `autoOpenSetup` off for every test except the lock-in one (`{ setupPage: true }`). Pending owner confirmation: the e2e run after the I.3b fixes, plus I.1 and I.3b e2e. Overlay drag v4 in-game confirmation pending.
- Verified: desktop typecheck + 86/86 unit tests, draft-engine 88/88, api 284/284 (before E.2). NOT verified: live game roles and rune icons with a real Riot spectator response (owner to test), e2e since these changes, Rust, in-game overlay.
- Known limits: overlay clamp uses the whole 340x340 window; exclusive-fullscreen games may hide any overlay. Capability `core:window:allow-start-dragging` unused (left in `overlay.json`). Item sets still write every build type.
- Pipeline, build-type constants and fixes unchanged (see `docs/STATUS_ARCHIVE.md`, grep `MIN_BUILD_SHARE`, `ABUNDANT_GAMES`). CI runs on `ubuntu-24.04` incl. e2e (not run since build-type changes: failures are real).
- Owner decision (Nov 20 2026): no more mock LCU, test seams or mock-based work; build and check everything in the desktop app. Existing mock and e2e stay untouched unless the owner says to remove them. F.1 is dropped.
- Rules kept: never `text-base` (use `text-[1rem]`); Flash left on the champion page; overlay shows no runes/spells; draft import writes all Apex item sets (G.1); click-suggestions OFF by default (`lcu.rs` allowlist). Compliance: `docs/COMPLIANCE.md`.
- Open archive items (grep `docs/STATUS_ARCHIVE.md` section 5): F import test seam, overlay hotkey plugin, locked champion from gameflow session. Backlog: per-role synergies, game-end popup switch, `GameSummary` polling test seam, `Draft.tsx` `poolZ` overall rate.

## Next Step
If the owner reports the Rust build failing, the overlay handle wrong in game, the setup page (build chooser, fast auto-import, "Imported" badge, new draft side column) or the game-start jump to the Live tab misbehaving in the desktop app, or a failing e2e, fix that first. Then **E.2c** (scaling data, see `docs/DRAFT_TAGS.md`).

## Files to Read Next
1. `docs/DRAFT_TAGS.md` (whole, short), `PLAN.md` E.2c line only, `services/api/src/store.ts` (`draftStats`, around lines 214 to 230 only), `packages/schema` `DraftStats` only.

## Do Not Touch
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`), `node_modules`, `dist`, `target`, `apps/desktop/src-tauri/gen/`, `apps/desktop/src-tauri/icons/`, `test-results`, `playwright-report`, `*.db`.
- `docs/STATUS_ARCHIVE.md` (grep only), `services/api/src/*.test.ts`, `packages/*` (except named by a step).
- Rust (`src-tauri/src`) unless a step names it or the owner pastes a compile error.

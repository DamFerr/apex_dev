# INSTRUCTIONS (read this first, every chat)

You are my senior full-stack and desktop-app engineer on **Project Apex**, an all-in-one League of Legends desktop app. This file is the standing brief. The repo is: https://github.com/DamFerr/apex_dev (branch `main`).

## 1. Token-saving rules (mandatory, they override everything below)

**What to read, and nothing else**
1. Read ONLY: `INSTRUCTIONS.md`, `STATUS.md`, and the exact files listed under "Files to Read Next" in `STATUS.md`.
2. Read `PLAN.md` ONLY if context on the current step is missing (and then only the section for that step ID: `grep -n` / `sed -n`, not the whole file).
3. Never scan the whole repository. Never run `ls -R`, `find`, `tree`, or `git ls-files` on the repo root. Listing a single directory is allowed only if `STATUS.md` names it.
4. Never open: lockfiles (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `Cargo.lock`), `node_modules`, `dist`, `target`, `gen/`, `test-results`, `playwright-report`, `*.db`, images/icons, fonts, or any media/data asset.
5. `docs/STATUS_ARCHIVE.md` is the old long handoff. Never read it in full; use `grep -n -i "<keyword>"` only when you need a past decision.
6. For files over ~150 lines, read only the part you need (`grep -n` then `sed -n 'A,Bp'`). Do not re-read a file you just edited.

**How to get files cheaply (do not rely on a GitHub page fetch)**
- Single file: `curl -sL https://raw.githubusercontent.com/DamFerr/apex_dev/main/<path>`
- Or shallow clone once: `git clone --depth 1 https://github.com/DamFerr/apex_dev.git`, then read only the allowed files from it.
- If both fail, tell me in one line and ask me to upload the files listed in `STATUS.md` (not the whole repo).
- Never guess a file's contents.

**Work size**
- Execute exactly ONE step per chat turn: the "Next Step" in `STATUS.md` (a step ID from `PLAN.md`). Do not start the following step.
- A step touches at most ~4 source files plus their tests. If it needs more, split it in `PLAN.md` into smaller sub-steps, do the first one, and say so.
- Run only the checks that cover what you changed (typecheck plus the affected package's tests), not the whole suite. Skip e2e unless the step is about e2e; say "e2e not run".
- Keep replies short. Do not paste whole files or long diffs into the chat; the zip carries the code.

**End of every step: update `STATUS.md` and zip**
- Rewrite `STATUS.md` (do not append history). It must stay under ~40 lines and keep exactly four sections: Current State, Next Step, Files to Read Next, Do Not Touch.
- Mark the finished step in `PLAN.md` only if its status line changes (include `PLAN.md` in the zip only then).
- Package ONLY the files you modified or created, including the updated `STATUS.md`, at their exact repo-relative paths, in ONE `.zip`, so I can drag-and-drop overwrite them locally. **Never include unchanged files.** No lockfile unless a dependency changed. List any files I must delete.
- Never send a zip you believe is broken. Never put secrets in the zip, repo, or chat.

## 2. Reply format at the end of each step (one message)
1. **Changed and why** (3 to 6 lines).
2. **The zip** (and delete list, if any).
3. **Commands** for Windows PowerShell, plus what I should see if it works.
4. **Works / still mocked or partial / next step.** Add a one-line suggested commit message.

At the start of a chat: after reading, give a status of at most 5 lines, then do the Next Step immediately, unless I gave you something specific in the same message (do that first, then continue).

If something fails, I will paste the errors. Fix the root cause, send a new zip, and do not move on until it works. Ask at most one clarifying question, only if something truly blocks you; otherwise decide, state the assumption in one line, and continue.

## 3. Sources of truth
- The **repo is the current state and wins** over `PLAN.md` when they disagree. Note the difference in `STATUS.md` (one line) or `PLAN.md` section 4.
- `PLAN.md` is the master plan (vision, features, engine, roadmap, step backlog, compliance).
- Riot rules: `PLAN.md` section 9 and `docs/COMPLIANCE.md` (read the latter only for steps touching overlay, LCU, data shown about players, or assets).

## 4. Repo quick facts (do not re-discover)
- pnpm monorepo: `apps/desktop` (Tauri 2 + React + TS + Vite + Tailwind + Zustand + TanStack Query; Rust in `src-tauri/src`: `lcu.rs`, `overlay.rs`, `lib.rs`), `services/api` (Fastify + Node SQLite backend, Riot client, collector), `packages/` (`schema`, `stats-core`, `lcu-core`, `lcu-mock`, `draft-engine`).
- Commands (PowerShell, repo root): `pnpm install`, `pnpm api` (backend), `pnpm tauri dev` (app), `pnpm typecheck`, `pnpm build`, `pnpm test` (all unit tests), `pnpm --filter desktop test:e2e`. One package: `pnpm --filter @apex/api test`, etc.
- Env: `services/api/.env` (git-ignored), documented in `services/api/.env.example`. The Riot API key lives only there and on the backend, never in the client. A new env variable goes (commented) into `.env.example`, and I get exact instructions for my own `.env`.
- The build environment has no League client, no browser and no Rust toolchain: say clearly what was NOT verified.

## 5. Tech rules
- Follow what the repo uses. Do not switch the stack without telling me why in two sentences and getting my OK.
- All UI data goes through the typed API client layer in `apps/desktop/src/lib/api`. Never put an API key in the client.
- The LCU connector is tested against `packages/lcu-mock` (simulates champ select: bans, swaps, trades, dodges).
- Reuse before creating: check `apps/desktop/src/components` and the design tokens (`index.css`, `tailwind.config.js`) before adding any component or style.

## 6. Quality and statistics principles
- Statistical honesty: show sample sizes, Bayesian-shrunk win rates and Wilson intervals; "low data" badge under 50 games; never present tiny samples as meaningful. Patch deltas and WPA are correlations, and the UI says so.
- Performance budget: cold start under 2 s, tab switch under 100 ms, draft evaluation under 150 ms. Respect the "reduce motion" setting.
- Code: clean, typed, commented where the logic is not obvious. Tests for stats math, LCU event handling, collector logic (rate limiting, rank filtering), and any new pure function.

## 7. Design (keep consistent, extend the existing design system)
- Premium desktop feel (Discord / Blitz / Linear / Raycast), not a website in a window. Dark first (deep navy/charcoal), one vivid accent plus gold or teal highlight; light and colorblind-safe themes exist. Glass and glow sparingly (blurred panels, 1px low-opacity borders, soft shadows).
- Inter plus the display font, Lucide icons, reusable components. Champion art and icons only from Data Dragon, within Riot's asset policy.
- Shell: frameless window, own title bar, slim sidebar, Ctrl+K palette, status area, min width 1100 px, keyboard accessible.
- Animation (60 fps, GPU-friendly): page fade/slide, staggered lists, hover lift, animated counters, drawn-in charts, shimmer skeletons, spring micro-interactions; eased win-probability bar and ranked recommendation slide-ins in champ select. Everything respects "reduce motion".
- Less text, more numbers, colours and icons: hints go in tooltips (with `sr-only` text for screen readers), not sentences.

## 8. Riot compliance (check before building anything touching these)
No hidden information (nothing the game itself hides), no gameplay automation or input injection, optional LCU conveniences (auto-accept etc.) OFF by default, correct legal disclaimer, Data Dragon asset policy, no harassment or doxxing features, estimates labelled as estimates. If a step risks a policy issue: flag it before building and propose a compliant alternative.

## 9. Scope discipline
- Do not skip roadmap phase gates (`PLAN.md` section 7), but keep modules open for later phases (P2 to P5) without rewrites.
- Scope creep: stay inside the current step. Put good ideas in the `PLAN.md` backlog as a one-line note instead of building them.
- Repo vs plan conflict: follow the repo, note the difference. Stack change: ask first.

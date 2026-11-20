# Draft layer B: a real source for engage, peel, poke, scaling, waveclear (E.1)

Rule (PLAN section 6.1): no guessing from Data Dragon class tags. Every layer B number must be **measured from games Apex collected**, shrunk like the other layers, shown with its sample size, and labelled when it is an estimate. Already measured today: damage split, damage taken (frontline), CC time per minute (`CompProfile`, `teamComp`).

Checked against the repo (`store.ts`, `riot.ts`): `matches.duration` and the win flag are stored per game; `participants` already holds role, CC time (`timeCCingOthers`) and damage taken. Not stored: heals and shields on teammates. What Riot's Match-v5 offers beyond that was NOT checked against a live match JSON here (no Riot access from the build environment): verify field names before building.

| Tag | Decision | Source (measured) | Cost |
|---|---|---|---|
| **Scaling** | Build first | Win rate of a champion in its role by game length (early under 25 min, mid, late over 33 min), from `matches.duration` + win. Scaling score = shrunk late rate minus shrunk early rate, only with enough games in both buckets. Labelled "correlation" like patch deltas (long games are also stronger-team games). | No collector change, one query, no new column |
| **Peel** | Build second | Heals plus shields on teammates per minute (Match-v5 `totalHealsOnTeammates`, `totalDamageShieldedOnTeammates`) together with CC time per minute. Team value = sum over the team, like `takenPerMin` and `ccPerMin`. | Two new `participants` columns; older games have none (null, not 0) |
| **Engage** | Defer | Closest measured signals are CC time and damage taken (already shown as Frontline and Crowd control). A real "who starts the fight" measure is not in Match-v5 and needs timeline event analysis. Candidate field `challenges.enemyChampionImmobilizations` (verify it exists). | Research, possibly a timeline job |
| **Waveclear** | Defer | Lane CS at 10 and 15 min from the timeline (we keep timelines for a bucket of games, so small samples). It measures lane CS, not clear speed, so it would be named "Lane CS". | Timeline sample only |
| **Poke** | Drop | No honest per-champion measure exists in the data (damage before a fight is not recorded). A curated list is the only source, and it would be opinion. Do not model it unless the owner supplies a curated list. | none |

Model rules for anything added: new terms go through `model.ts` constants (hand-set, documented), antisymmetric like the rest, shrunk toward neutral with few games, and the Team composition panel shows the number with its games. Weights stay heuristic until layer C (learned) exists; the UI keeps saying so.

## Revised E.2 (replaces the old E.2 text)
- **E.2c** Scaling: store nothing new; backend query for win rate by game-length bucket per champion and role, `DraftStats` field, `createRealData` scaling value, tests.
- **E.2d** Scaling in the model and UI: layer B term (small, capped) and a Scaling row in Team composition with games and LOW DATA.
- **E.2e** Peel: collector stores heals and shields on teammates, stats endpoint, `CompProfile` fields (needs a re-collect to fill).
- **E.2f** Peel in `teamComp` and the Team composition panel.
- Engage and Waveclear stay open until the owner wants them; Poke is dropped.

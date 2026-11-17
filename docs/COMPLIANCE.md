# Riot compliance checklist (plan section 12)

This is an engineering checklist, not legal advice. Review current Riot Developer Policies and ToS before shipping.

| # | Rule | Status |
|---|---|---|
| 1 | Register product, production API key, legal disclaimer | Disclaimer shown in Settings and README. Key application: TODO (Phase 0). No key in the client. |
| 2 | No hidden information | Only data the League client already shows the player (champ select via LCU). No enemy cooldown or fog-of-war tracking. The overlay window is groundwork only and not reachable from the UI. Live Game scouting (Spectator-v5) shows only the ten players and champions the loading screen shows, plus public rank data and collected champion win rates. It never shows in-game state (positions, cooldowns, items, gold) and Apex does not guess roles beyond the Smite flag. |
| 3 | No gameplay automation or input injection | None. Auto-import is OFF by default and, when on, only writes the "Apex: <champion>" rune page and your summoner spells. Auto-accept and auto-pick are not built. Re-check each against current policy before enabling. |
| 4 | No harassment or doxxing | Notes (later) stay local. No smurf score yet; it must be labelled an estimate. |
| 5 | Monetization rules | Decision pending (Phase 0). |
| 6 | Data Dragon asset rules | Icons (champions, items, summoner spells, runes, stat shards, abilities) and splash art load from Riot's CDN at runtime through one component (`GameIcon`), are not bundled or redistributed, and fall back to names/initials offline. Role glyphs (`RoleIcon`) and rank emblems (`TierIcon`: faceted gem on a beveled shield, crown grows with the tier, four division pips) are our own original drawings. **Riot's rank emblems are NOT used and must not be added:** checked against the Developer Portal policies (Nov 2026), which allow only Data Dragon, the Press Kit and game static data as Riot assets and say products must not closely resemble Riot's own in style. Rank emblems are in none of those, and CommunityDragon is a community scrape under Riot's "Legal Jibber Jabber", not an approved Riot source. Do not copy the look of the in-game emblems (wings, crest shapes) either. |

Other: the app reads champ select data from the local League client. It writes only your summoner spells in champ select (PATCH my-selection) and rune pages named "Apex: <champion>" (explicit button, or opt-in auto-import which is off by default). The Rust command refuses any other endpoint and any method except GET/POST/PUT; it never touches your own pages. The overlay never intercepts game input (click-through).


## Policy flags for later phases (read before building these; found in the Nov 2026 policy check, verify on the Developer Portal)
- **MMR / ELO estimates.** The plan lists "MMR band estimates" (PDF 4.1). The General Policy forbids alternatives to the official ranking system, including MMR or ELO calculators. Do not build an MMR estimate; use the official tier/division/LP only.
- **Power-spike alerts and item-spike indicators** (PDF 3.3 "power spike timelines", 3.7 overlay "item-spike indicators"). Third-party summaries of the League rules prohibit notifications that alert players when a power spike hits. Keep these out of the in-game overlay; analysis after the game is fine.
- **Ranked Solo/Duo champ select names.** Players' names must stay hidden in ranked champ select (visible again at loading screen). The Draft screen shows champions only, never names. Keep it that way for any new draft feature.
- **Queues.** The collector reads Ranked Solo only (queue 420). Brawl and League Classic data must not be aggregated or shown.
- **Scouting and production key.** Live Game scouting and "smurf score" (P4) can weigh on the production key application; describe them accurately and review before applying.

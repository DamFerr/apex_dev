# Riot compliance checklist (plan section 12)

This is an engineering checklist, not legal advice. Review current Riot Developer Policies and ToS before shipping.

| # | Rule | Status |
|---|---|---|
| 1 | Register product, production API key, legal disclaimer | Disclaimer shown in Settings and README. Key application: TODO (Phase 0). No key in the client. |
| 2 | No hidden information | Only data the League client already shows the player (champ select via LCU). No enemy cooldown or fog-of-war tracking. The overlay window is groundwork only and not reachable from the UI. Live Game scouting (Spectator-v5) shows only the ten players and champions the loading screen shows, plus public rank data and collected champion win rates. It never shows in-game state (positions, cooldowns, items, gold) and Apex does not guess roles beyond the Smite flag. |
| 3 | No gameplay automation or input injection | None. Auto-import is OFF by default and, when on, only writes the "Apex: <champion>" rune page and your summoner spells. Auto-accept and auto-pick are not built. Re-check each against current policy before enabling. |
| 4 | No harassment or doxxing | Notes (later) stay local. No smurf score yet; it must be labelled an estimate. |
| 5 | Monetization rules | Decision pending (Phase 0). |
| 6 | Data Dragon asset rules | Icons (champions, items, summoner spells, runes, stat shards, abilities) and splash art load from Riot's CDN at runtime through one component (`GameIcon`), are not bundled or redistributed, and fall back to names/initials offline. Role glyphs are our own original drawings (`RoleIcon`), not Riot artwork. Rank emblems are our own drawings (`TierIcon`), not Riot's; Riot's emblems would need an asset-policy check first. |

Other: the app reads champ select data from the local League client. It writes only your summoner spells in champ select (PATCH my-selection) and rune pages named "Apex: <champion>" (explicit button, or opt-in auto-import which is off by default). The Rust command refuses any other endpoint and any method except GET/POST/PUT; it never touches your own pages. The overlay never intercepts game input (click-through).

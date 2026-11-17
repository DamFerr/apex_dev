import { shrink, type Tally } from "./index";

/**
 * Win Probability Added (WPA) of an item (plan 3.2, owner request).
 *
 * WPA = how much owning the item changes the win chance, in percentage points, compared with games of the same champion that did
 * NOT own it. Final inventories are biased (winning teams earn gold and finish more items, and long games let everyone finish more),
 * so the comparison is made inside strata the caller defines (Apex uses game length x number of finished items): owners are only ever
 * compared with non-owners from the same stratum. What is left is still a correlation, not proof that the item causes wins.
 *
 * Per stratum the expected win rate of an owner without the item is the non-owners' rate, shrunk toward the stratum's overall rate
 * (so a stratum with almost no non-owners falls back to the stratum average), which is itself shrunk toward the champion's overall rate.
 * The difference (observed owner wins - expected wins) is divided by (owner games + `strength`): shrinkage toward 0, so a tiny sample
 * can never look like a big effect (3 wins in 3 games is worth about +2.8 pp, like the matchup deltas).
 */
export interface WpaStratum { owners: Tally; others: Tally }
export interface WpaStat {
  /** Games and wins of the champion with the item. */ games: number; wins: number;
  /** Win rate (0..1) those games would be expected to have without the item. */ expected: number;
  /** Win probability added in percentage points (shrunk). + means owning the item goes with more wins. */ wpa: number;
  /** 95% range of `wpa`, percentage points. */ lo: number; hi: number;
}

export function itemWpa(strata: WpaStratum[], strength = 50, stratumStrength = 40): WpaStat {
  let games = 0, wins = 0, allGames = 0, allWins = 0;
  for (const s of strata) { games += s.owners.games; wins += s.owners.wins; allGames += s.owners.games + s.others.games; allWins += s.owners.wins + s.others.wins; }
  if (games <= 0) return { games: 0, wins: 0, expected: 0.5, wpa: 0, lo: 0, hi: 0 };
  const overall = allGames > 0 ? allWins / allGames : 0.5;
  let expectedWins = 0, variance = 0;
  for (const s of strata) {
    if (s.owners.games <= 0) continue;
    const all = shrink(s.owners.wins + s.others.wins, s.owners.games + s.others.games, overall, stratumStrength);
    const e = shrink(s.others.wins, s.others.games, all, stratumStrength);
    expectedWins += s.owners.games * e; variance += s.owners.games * e * (1 - e);
  }
  const denom = games + strength, z = 1.96, diff = wins - expectedWins, half = z * Math.sqrt(variance);
  return { games, wins, expected: expectedWins / games, wpa: (diff / denom) * 100, lo: ((diff - half) / denom) * 100, hi: ((diff + half) / denom) * 100 };
}

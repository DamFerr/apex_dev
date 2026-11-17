import { useMemo, type ReactNode } from "react";
import { buildTierList, MIN_DELTA_GAMES, patchDelta, winRateBand } from "@apex/stats-core";
import type { ChampionDetail } from "@apex/schema";
import { Delta, winTone } from "../components/Delta";
import { LowBadge, pct, rate, signed } from "../components/StatRows";
import { AnimatedNumber } from "../components/ui";
import { useChampionPatches, useChampions } from "../lib/api";

const BAND = { good: "text-good", bad: "text-bad", neutral: "text-text" } as const;

function Cell({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (<div className="px-4 py-3 min-w-0" title={hint}>
    <div className="text-xs text-muted whitespace-nowrap">{label}</div>
    <div className="font-display text-2xl font-semibold mt-0.5 tabular-nums whitespace-nowrap">{children}</div>
  </div>);
}

/**
 * One row of big numbers at the top of a champion page: tier, win rate, change since the previous patch, pick rate, ban rate, games.
 * Tier and change are for the champion's busiest role (the same role the tier list and the patch history default to); win, pick, ban and games cover all its roles.
 * Win rate is the adjusted (shrunk) one, coloured by the shared `winRateBand` scale, and the number is always shown.
 */
export function StatStrip({ c }: { c: ChampionDetail }) {
  const role = c.roles[0], s = rate(c.wins, c.games);
  const list = useChampions(role).data, patches = useChampionPatches(c.id, role).data;
  const tier = useMemo(() => {
    if (!list) return undefined;
    return buildTierList(list.champions.map((x) => ({ id: x.id, games: x.games, wins: x.wins, bans: x.bans })), list.totalGames).find((r) => r.id === c.id)?.grade ?? null;
  }, [list, c.id]);
  const delta = useMemo(() => { const [cur, prev] = patches?.patches ?? []; return cur && prev && cur.matches > 0 && prev.matches > 0 ? { d: patchDelta(prev, cur), from: prev.patch } : null; }, [patches]);
  const pick = c.totalGames > 0 ? (c.games / c.totalGames) * 100 : 0, ban = c.totalGames > 0 ? (c.bans / c.totalGames) * 100 : 0;
  return (<section aria-label="Key numbers" className="glass rounded-lg grid grid-cols-6 divide-x divide-line/10">
    <Cell label="Tier" hint={role ? `Tier in ${role}, from the tier list` : undefined}>
      {tier === undefined ? <span className="text-muted">…</span> : tier ? <span className="text-gold">{tier}</span> : <span className="text-muted" title="Too few games in this role to grade">–</span>}
    </Cell>
    <Cell label="Win rate (adjusted)" hint={`Raw ${pct(s.raw)} · 95% range ${pct(s.lo, 0)}–${pct(s.hi, 0)}`}>
      <span className={BAND[winRateBand(s.adj)]}><AnimatedNumber value={s.adj * 100} suffix="%" /></span>
    </Cell>
    <Cell label="vs last patch" hint={delta ? (delta.d.winDelta === null ? `Needs at least ${MIN_DELTA_GAMES} games in both patches` : `Since ${delta.from}. 95% range ${signed(delta.d.winRange![0])} to ${signed(delta.d.winRange![1])} pp${delta.d.significant ? "" : ": could be luck"}`) : "Needs two patches with data"}>
      {delta ? <span className="text-lg"><Delta value={delta.d.winDelta} tone={winTone(delta.d)} /></span> : <span className="text-muted">–</span>}
    </Cell>
    <Cell label="Pick rate"><AnimatedNumber value={pick} suffix="%" /></Cell>
    <Cell label="Ban rate"><AnimatedNumber value={ban} suffix="%" /></Cell>
    <Cell label="Games" hint={s.badge === "low" ? "Low data: treat with caution" : `${s.badge} sample`}>
      <AnimatedNumber value={c.games} decimals={0} /><LowBadge games={c.games} />
    </Cell>
  </section>);
}

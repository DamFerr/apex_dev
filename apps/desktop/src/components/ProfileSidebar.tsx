import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { QUEUE_FILTERS, type QueueFilter } from "@apex/schema";
import { ChampIcon } from "./ChampIcon";
import { ROLE_LABEL, RoleIcon } from "./RoleIcon";
import { LowBadge, WinRateCell, rate } from "./StatRows";
import { Skeleton, spring } from "./ui";
import { useMatches } from "../lib/api";
import { useChampName } from "../lib/ddragon";
import { championPerformance, csPerMin, kdaOf, rolePerformance } from "../lib/profileStats";

/** Games the overview looks at: the player's latest finished games, the same window the draft's champion pool uses (the backend caps a page at 20). */
export const OVERVIEW_GAMES = 20;

function Panel({ title, games, children }: { title: string; games: number; children: ReactNode }) {
  return (
    <section className="glass rounded-lg p-4" aria-label={title}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        <span className="text-xs text-muted tabular-nums" title={`Counted over the player's latest ${games} games. A short window, so every number is a small sample.`}>{games} games<LowBadge games={games} /></span>
      </div>
      {children}
    </section>);
}

/** Win rate (adjusted for sample size, with its raw value and range in the tooltip) and the W/L count, right aligned. */
function WinLoss({ wins, games }: { wins: number; games: number }) {
  const r = rate(wins, games);
  return (<div className="text-right leading-tight shrink-0">
    <WinRateCell value={r.adj} raw={r.raw} lo={r.lo} hi={r.hi} note={`${games} games`} />
    <div className="text-xs text-muted tabular-nums">{wins}W · {games - wins}L</div>
  </div>);
}

/**
 * Overview of a player's latest games for the profile: champion performance and role performance (E: Played with and Pings follow in P.2).
 * Computed from the match list the backend already serves, for the queue chosen on the match history. `stacked` = two columns, for the Overview tab on narrow windows.
 */
export function ProfileSidebar({ id, queue, stacked = false }: { id: string; queue: QueueFilter; stacked?: boolean }) {
  const q = useMatches(id, OVERVIEW_GAMES, queue), champName = useChampName();
  const { champs, roles, n } = useMemo(() => {
    const ms = q.data ?? [];
    return { champs: championPerformance(ms).slice(0, 6), roles: rolePerformance(ms), n: ms.length };
  }, [q.data]);
  const queueLabel = QUEUE_FILTERS.find((f) => f.key === queue)?.label ?? "";
  const top = Math.max(1, ...roles.map((r) => r.games));
  return (
    <aside aria-label="Performance overview" className={stacked ? "grid grid-cols-2 gap-4 mt-4 items-start" : "space-y-4"}>
      {q.isLoading && <><Skeleton className="h-64" /><Skeleton className="h-48" /></>}
      {q.isError && <div role="alert" className="glass rounded-lg p-4 text-sm text-bad">{(q.error as Error).message}</div>}
      {q.isSuccess && n === 0 && <div className="glass rounded-lg p-4 text-sm text-muted">No {queueLabel} games in the latest history to summarise.</div>}
      {n > 0 && <>
        <Panel title="Champion performance" games={n}>
          <ul className="space-y-1">
            {champs.map((c) => {
              const name = champName(c.champion), kda = kdaOf(c.kills, c.deaths, c.assists), cs = csPerMin(c.cs, c.seconds);
              return (<li key={c.champion} className="flex items-center gap-3 min-h-12">
                <ChampIcon id={c.champion} name={name} size={36} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-sm font-medium truncate">{name}</div>
                  <div className="text-xs text-muted tabular-nums" title={`${(c.kills / c.games).toFixed(1)} / ${(c.deaths / c.games).toFixed(1)} / ${(c.assists / c.games).toFixed(1)} per game, ${c.games} games`}>
                    {kda === null ? "Perfect" : kda.toFixed(1)} KDA · {cs.toFixed(1)} CS/min</div>
                </div>
                <WinLoss wins={c.wins} games={c.games} />
              </li>);
            })}
          </ul>
        </Panel>
        <Panel title="Role performance" games={roles.reduce((s, r) => s + r.games, 0)}>
          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r.role} className="relative flex items-center gap-3 min-h-12 px-2 rounded-md overflow-hidden">
                <motion.div aria-hidden className="absolute inset-0 origin-left bg-accent/10" initial={false} animate={{ scaleX: r.games / top }} transition={spring} />
                <span className="relative"><RoleIcon role={r.role} size={22} decorative /></span>
                <div className="relative min-w-0 flex-1 leading-tight">
                  <div className="text-sm font-medium">{ROLE_LABEL[r.role]}</div>
                  <div className="text-xs text-muted tabular-nums">{r.games} games</div>
                </div>
                <div className="relative"><WinLoss wins={r.wins} games={r.games} /></div>
              </li>))}
          </ul>
        </Panel>
        <p className={`text-xs text-muted ${stacked ? "col-span-2" : ""}`}>Latest {n} {queueLabel} games, the queue chosen under Match history. Win rates are adjusted for small samples; hover one for the raw rate and its range.</p>
      </>}
    </aside>);
}

import { motion } from "framer-motion";
import { TierIcon } from "../components/TierIcon";
import { Link } from "react-router-dom";
import { useUi } from "../lib/store";
import { shrink, wilson, sampleBadge } from "@apex/stats-core";
import { Skeleton, StatCard, ProgressRing } from "../components/ui";
import { SearchBox } from "../components/SearchBox";
import { RiotIdPrompt } from "../components/RiotIdPrompt";
import { MatchRowBody, QueueFilterChips } from "../components/MatchRow";
import { useMatches, useSummoner } from "../lib/api";

export function Home() {
  const me = useUi((s) => s.myRiotId), queue = useUi((s) => s.queueFilter) ?? "all", setUi = useUi((s) => s.patch), sum = useSummoner(me), games = useMatches(me, 10, queue);
  const ms = games.data ?? [];
  const wins = ms.filter((m) => m.win).length;
  const [lo, hi] = wilson(wins, ms.length);
  const kda = ms.length ? (ms.reduce((a, m) => a + m.kills + m.assists, 0) / Math.max(1, ms.reduce((a, m) => a + m.deaths, 0))) : 0;
  const csm = ms.length ? ms.reduce((a, m) => a + m.cs / (m.durationSec / 60), 0) / ms.length : 0;
  const r = sum.data?.rank;
  if (!me) return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Home</h1>
    <p className="text-sm text-muted mt-1 mb-6">Search any player, or add your own Riot ID to see your rank and recent games here.</p>
    <div className="mb-6"><SearchBox /></div>
    <RiotIdPrompt />
  </>);
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Home</h1>
    <p className="text-sm text-muted mt-1 mb-6">Your recent games. Win rates show their uncertainty.</p>
    <div className="mb-6"><SearchBox /></div>
    <div className="grid grid-cols-3 gap-4">
      <div className="glass rounded-lg p-5 flex items-center gap-4">
        {r ? <><ProgressRing value={r.lp} label="LP" text={`${r.lp} LP`} /><TierIcon tier={r.tier} division={r.division} size={44} />
          <div><div className="font-display text-xl font-semibold">{r.tier[0] + r.tier.slice(1).toLowerCase()} {r.division}</div>
            <div className="text-xs text-muted">{r.lp} LP · {r.wins}W {r.losses}L{sum.data?.platform ? ` · ${sum.data.platform.toUpperCase()}` : ""}</div></div></>
          : sum.data ? <div className="text-sm text-muted">Unranked in Ranked Solo/Duo</div> : sum.isError ? <div className="text-sm text-bad">{(sum.error as Error).message}</div> : <Skeleton className="h-20 w-full" />}
      </div>
      {games.data && ms.length ? <>
        <StatCard label="Recent win rate" value={wins / ms.length * 100} suffix="%"
          hint={`95% range ${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}% · ${sampleBadge(ms.length)} data · adjusted ${(shrink(wins, ms.length, 0.5) * 100).toFixed(1)}%`} />
        <StatCard label="KDA · CS/min" value={kda} decimals={2} hint={`${csm.toFixed(1)} CS per minute`} />
      </> : games.data ? <div className="glass rounded-lg p-5 text-sm text-muted col-span-2">No recent games found.</div> : <><Skeleton className="h-28" /><Skeleton className="h-28" /></>}
    </div>
    <div className="flex items-baseline justify-between mt-8 mb-3"><h2 className="font-display text-lg font-semibold">Recent games</h2>
      <Link to="/recap" className="focus-ring text-sm text-accent hover:underline rounded">Last game recap →</Link></div>
    <div className="mb-3"><QueueFilterChips value={queue} onChange={(k) => setUi({ queueFilter: k })} /></div>
    <motion.ul className="space-y-2" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.04 } } }}>
      {games.isError && <li className="text-sm text-bad">{(games.error as Error).message}</li>}
      {games.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
      {ms.map((m) => (
        <motion.li key={m.id} variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} whileHover={{ x: 3 }}
          className={`glass rounded-lg min-h-[4.25rem] py-2 px-4 flex items-center border-l-2 ${m.win ? "border-l-good" : "border-l-bad"}`}>
          <MatchRowBody m={m} />
        </motion.li>))}
      {games.isSuccess && ms.length === 0 && <li className="text-sm text-muted">No games in this queue in your recent history.</li>}
    </motion.ul>
  </>);
}

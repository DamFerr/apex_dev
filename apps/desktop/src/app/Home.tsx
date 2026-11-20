import { useState } from "react";
import { motion } from "framer-motion";
import { TierIcon } from "../components/TierIcon";
import { Link } from "react-router-dom";
import { useUi } from "../lib/store";
import { shrink, wilson, sampleBadge } from "@apex/stats-core";
import { Skeleton, StatCard, ProgressRing } from "../components/ui";
import { rankTitle } from "../lib/lpRing";
import { CUTOFF_HINT, useApexRing } from "../lib/useApexRing";
import { RiotIdPrompt } from "../components/RiotIdPrompt";
import { MatchFilterChips, QueueFilterChips } from "../components/MatchRow";
import { ExpandableMatchRow } from "../components/MatchDetail";
import { isQueueFilter } from "@apex/schema";
import { useMatches, usePool, useSummoner } from "../lib/api";
import { useChampName } from "../lib/ddragon";

export function Home() {
  const me = useUi((s) => s.myRiotId), queue = ((q) => (isQueueFilter(q) ? q : "all"))(useUi((s) => s.queueFilter)), setUi = useUi((s) => s.patch), mf = useUi((s) => s.matchFilter), sum = useSummoner(me), games = useMatches(me, 10, queue, mf), pool = usePool(me), champName = useChampName();
  const [open, setOpen] = useState<string | null>(null);
  const poolChamps = (pool.data ?? []).map((p) => ({ id: p.champion, name: champName(p.champion) })).sort((a, b) => a.name.localeCompare(b.name));
  const ms = games.data ?? [];
  const wins = ms.filter((m) => m.win).length;
  const [lo, hi] = wilson(wins, ms.length);
  const kda = ms.length ? (ms.reduce((a, m) => a + m.kills + m.assists, 0) / Math.max(1, ms.reduce((a, m) => a + m.deaths, 0))) : 0;
  const csm = ms.length ? ms.reduce((a, m) => a + m.cs / (m.durationSec / 60), 0) / ms.length : 0;
  const r = sum.data?.rank, ring = useApexRing(r, sum.data?.platform);
  if (!me) return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Home</h1>
    <p className="text-sm text-muted mt-1 mb-6">Press Ctrl+K to search any player, or add your own Riot ID to see your rank and recent games here.</p>
    <RiotIdPrompt />
  </>);
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Home</h1>
    <p className="text-sm text-muted mt-1 mb-6">Your recent games. Win rates show their uncertainty.</p>
    <div className="grid grid-cols-3 gap-4">
      <div className="glass rounded-lg p-5 flex items-center gap-4">
        {r ? <><ProgressRing value={ring!.value} tone={ring!.full ? "gold" : "accent"} aria={ring!.label} text={`${r.lp} LP`} /><TierIcon tier={r.tier} division={r.division} size={44} />
          <div><div className="font-display text-xl font-semibold">{rankTitle(r.tier, r.division)}</div>
            <div className="text-xs text-muted">{r.lp} LP · {r.wins}W {r.losses}L{sum.data?.platform ? ` · ${sum.data.platform.toUpperCase()}` : ""}</div>
            {ring!.note && <div className="text-xs text-muted" title={CUTOFF_HINT}>{ring!.note}</div>}</div></>
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
    <div className="mb-3 space-y-2"><QueueFilterChips value={queue} onChange={(k) => setUi({ queueFilter: k })} />
      <MatchFilterChips value={mf} champions={poolChamps} onChange={(f) => setUi({ matchFilter: f })} /></div>
    <motion.ul className="space-y-2" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.04 } } }}>
      {games.isError && <li className="text-sm text-bad">{(games.error as Error).message}</li>}
      {games.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
      {ms.map((m) => <ExpandableMatchRow key={m.id} m={m} riotId={me} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} />)}
      {games.isSuccess && ms.length === 0 && <li className="text-sm text-muted">No games in this queue{mf.champion || mf.role ? " for this champion/role" : ""} in your recent history.</li>}
    </motion.ul>
  </>);
}

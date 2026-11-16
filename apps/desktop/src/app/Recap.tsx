import { perfGrade, performanceScore, type PerfGrade } from "@apex/stats-core";
import { RoleIcon } from "../components/RoleIcon";
import { LoadoutIcons } from "../components/LoadoutIcons";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import type { PostGameRecap, RecapMetric } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { pct } from "../components/StatRows";
import { ProgressRing, Skeleton, spring } from "../components/ui";
import { RiotIdPrompt } from "../components/RiotIdPrompt";
import { useRecap } from "../lib/api";
import { useUi } from "../lib/store";

const fmt = (m: RecapMetric, v: number) => (m.id === "kda" ? v.toFixed(2) : m.id === "cs" ? v.toFixed(1) : Math.round(v).toLocaleString());
/** Percent difference of you vs a reference average (positive = better than the reference). */
const delta = (you: number, avg: number | null) => (avg && avg > 0 ? (you / avg - 1) * 100 : null);

/** Score against collected rank averages when there are enough games, otherwise against your own recent games, otherwise none. */
export function scoreOf(r: PostGameRecap): { score: number; grade: PerfGrade; basis: "rank" | "you" } | null {
  for (const basis of ["rank", "you"] as const) {
    const ratios = r.metrics.flatMap((m) => { const ref = basis === "rank" ? m.vsRank : m.vsYou; return ref && ref > 0 ? [m.you / ref] : []; });
    const score = performanceScore(ratios);
    if (score !== null) return { score, grade: perfGrade(score), basis };
  }
  return null;
}

const Delta = ({ d, label }: { d: number | null; label: string }) => d === null ? <span className="text-muted">{label}: n/a</span>
  : <span className={d >= 0 ? "text-good" : "text-bad"}>{label}: {d >= 0 ? "+" : ""}{d.toFixed(0)}%</span>;

function MetricCard({ m }: { m: RecapMetric }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={spring} className="glass rounded-lg p-4" aria-label={m.label}>
      <div className="text-xs text-muted">{m.label}</div>
      <div className="font-display text-3xl font-semibold mt-1 tabular-nums">{fmt(m, m.you)}<span className="text-sm text-muted font-normal">{m.unit}</span></div>
      <div className="text-xs mt-2 space-y-0.5">
        <div title={m.vsRank !== null ? `Average ${fmt(m, m.vsRank)}${m.unit}` : "Not enough collected games"}><Delta d={delta(m.you, m.vsRank)} label="vs rank" /></div>
        <div title={m.vsYou !== null ? `Your average ${fmt(m, m.vsYou)}${m.unit}` : "Needs 3 other recent games in this role"}><Delta d={delta(m.you, m.vsYou)} label="vs you" /></div>
        <div className="text-muted">#{m.lobbyRank} of 10 in this game</div>
      </div>
    </motion.div>);
}

export function Recap() {
  const me = useUi((s) => s.myRiotId), { riotId, matchId } = useParams(), id = riotId ? decodeURIComponent(riotId) : me;
  const q = useRecap(id, matchId ? decodeURIComponent(matchId) : undefined), r = q.data, s = r ? scoreOf(r) : null;
  if (!id) return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight mb-5">Game recap</h1>
    <RiotIdPrompt />
  </>);
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Game recap</h1>
    <p className="text-sm text-muted mt-1 mb-5">{id} · {matchId ? "the game you picked" : "latest game"}. Comparisons use collected Ranked Solo games and your own recent games.</p>
    {q.isLoading && <div className="grid gap-4"><Skeleton className="h-28" /><div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div></div>}
    {q.isError && <div role="alert" className="glass rounded-lg p-6 text-sm text-bad max-w-xl">{(q.error as Error).message}</div>}
    {r && <>
      <div className={`glass rounded-lg p-5 flex items-center gap-5 border-l-4 ${r.win ? "border-l-good" : "border-l-bad"}`}>
        <ChampIcon id={r.champion} name={r.championName} size={64} />
        <div className="flex-1 min-w-0">
          <div className={`font-display text-2xl font-semibold ${r.win ? "text-good" : "text-bad"}`}>{r.win ? "Victory" : "Defeat"}</div>
          <div className="text-sm">{r.championName}{r.role && <> · <span className="inline-flex items-center gap-1 align-middle"><RoleIcon role={r.role} size={14} decorative />{r.role}</span></>} · <span className="tabular-nums" aria-label="Score">{r.kills}/{r.deaths}/{r.assists}</span></div>
          <div className="text-xs text-muted">{r.queue} · {Math.round(r.durationSec / 60)} min · {new Date(r.playedAt).toLocaleString()}</div>
          <div className="mt-2"><LoadoutIcons loadout={r.loadout} size={26} /></div>
        </div>
        <div className="text-xs text-muted text-right"><div>Kill participation <span className="text-text tabular-nums">{pct(r.killParticipation, 0)}</span></div><div>Team damage share <span className="text-text tabular-nums">{pct(r.damageShare, 0)}</span></div></div>
        {s && <div className="flex items-center gap-3" title="Average of your four stats against the comparison average, 50 = exactly average">
          <ProgressRing value={s.score} size={84} label="Performance score" text={s.grade} />
          <div><div className="font-display text-xl font-semibold">Grade {s.grade}</div><div className="text-xs text-muted">{s.score}/100 vs {s.basis === "rank" ? "rank averages" : "your recent games"}</div></div>
        </div>}
      </div>
      <div className="grid grid-cols-4 gap-4 mt-4">{r.metrics.map((m) => <MetricCard key={m.id} m={m} />)}</div>
      <p className="text-xs text-muted mt-4 max-w-2xl">
        {r.baseline ? `Rank comparison: ${r.baseline.label}, ${r.baseline.games.toLocaleString()} collected games.` : "No rank comparison yet: not enough collected games for this champion and role."}{" "}
        {r.personal ? `Your comparison: ${r.personal.games} other recent games in this role.` : "Your comparison needs at least 3 other recent games in this role."}{" "}
        {!s && "No grade without a comparison. "}Numbers are shown, never guessed.
      </p>
      <p className="text-xs text-muted mt-2"><Link to={`/profile/${encodeURIComponent(id)}`} className="focus-ring underline rounded hover:text-text">Back to profile</Link></p>
    </>}
  </>);
}

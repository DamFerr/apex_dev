import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { TierIcon } from "../components/TierIcon";
import { ChampIcon } from "../components/ChampIcon";
import { LoadoutIcons } from "../components/LoadoutIcons";
import { MatchRowBody, QueueFilterChips } from "../components/MatchRow";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QUEUE_FILTERS, type MatchSummary } from "@apex/schema";
import { Chip, ProgressRing, Skeleton } from "../components/ui";
import { api, useScope, useSummoner } from "../lib/api";
import { useChampName } from "../lib/ddragon";
import { useUi } from "../lib/store";
import { Tabs } from "../components/Tabs";
import { MasteryTab } from "./ProfileTabs";
import { LpHistoryTab } from "./LpHistory";
import { RiotIdPrompt } from "../components/RiotIdPrompt";

function Detail({ id, riotId }: { id: string; riotId: string }) {
  const champName = useChampName();
  const q = useQuery({ queryKey: [useScope(), "detail", id, riotId], queryFn: () => api.getMatchDetail(id, riotId) });
  if (q.isError) return <div className="p-4 text-sm text-bad">{(q.error as Error).message}</div>;
  if (!q.data) return <div className="p-4 space-y-2"><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>;
  const maxDmg = Math.max(...q.data.participants.map((p) => p.damage));
  return (
    <div className="p-4 pt-1 grid grid-cols-1 gap-5">
      {(["blue", "red"] as const).map((team) => (
        <table key={team} className="w-full text-xs table-fixed">
          <colgroup><col style={{ width: 210 }} /><col style={{ width: 320 }} /><col style={{ width: 70 }} /><col style={{ width: 50 }} /><col /></colgroup>
          <caption className={`text-left font-medium pb-2 ${(team === "blue") === q.data.blueWon ? "text-good" : "text-bad"}`}>
            {team === "blue" ? "Blue team" : "Red team"} · {(team === "blue") === q.data.blueWon ? "Victory" : "Defeat"}</caption>
          <thead className="text-muted"><tr><th className="text-left font-normal">Player</th><th className="text-left font-normal">Loadout</th><th className="font-normal">KDA</th><th className="font-normal">CS</th><th className="text-left font-normal pl-3">Damage</th></tr></thead>
          <tbody>{q.data.participants.filter((p) => p.team === team).map((p) => (
            <tr key={p.name} className={`h-8 ${p.isYou ? "text-gold" : ""}`}>
              <td><span className="inline-flex items-center gap-2"><ChampIcon id={p.champion} name={champName(p.champion)} size={24} /><span>{p.name} <span className="text-muted">{champName(p.champion)}</span></span></span></td>
              <td className="pr-3"><LoadoutIcons loadout={p.loadout} size={22} /></td>
              <td className="text-center tabular-nums">{p.kills}/{p.deaths}/{p.assists}</td>
              <td className="text-center tabular-nums">{p.cs}</td>
              <td className="pl-3"><div className="flex items-center gap-2 min-w-[9rem]"><span className="w-14 text-right tabular-nums">{p.damage.toLocaleString()}</span><div className="h-1.5 flex-1 rounded-full bg-line/10"><motion.div className="h-full rounded-full bg-accent origin-left"
                initial={{ scaleX: 0 }} animate={{ scaleX: maxDmg > 0 ? p.damage / maxDmg : 0 }} style={{ width: "100%" }} /></div></div></td>
            </tr>))}</tbody>
        </table>))}
    </div>
  );
}

function MatchRow({ m, open, onToggle, riotId }: { m: MatchSummary; open: boolean; onToggle: () => void; riotId: string }) {
  return (
    <li className="glass rounded-lg overflow-hidden">
      <button aria-expanded={open} onClick={onToggle}
        className={`focus-ring w-full min-h-[4.25rem] py-2 px-4 flex items-center border-l-2 text-left ${m.win ? "border-l-good" : "border-l-bad"}`}>
        <MatchRowBody m={m} trailing={<motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={16} className="text-muted" /></motion.span>} />
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }} className="overflow-hidden"><Detail id={m.id} riotId={riotId} />
            <div className="px-4 pb-3"><Link to={`/recap/${encodeURIComponent(riotId)}/${encodeURIComponent(m.id)}`} className="focus-ring text-sm text-accent hover:underline rounded">Open full recap →</Link></div></motion.div>}
      </AnimatePresence>
    </li>
  );
}

export function Profile() {
  const { riotId } = useParams(), me = useUi((s) => s.myRiotId), id = riotId ? decodeURIComponent(riotId) : me;
  const recent = useUi((s) => s.recent), nav = useNavigate();
  const sum = useSummoner(id);
  const [filter, setFilter] = useState<"all" | "win" | "loss">("all");
  const queue = useUi((s) => s.queueFilter) ?? "all", setUi = useUi((s) => s.patch);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<"matches" | "lp" | "mastery">("matches");
  const q = useInfiniteQuery({
    queryKey: [useScope(), "matchpages", id, queue], initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getMatchPage(id, pageParam, 10, queue),
    getNextPageParam: (last) => last.nextCursor ?? undefined, enabled: sum.isSuccess,
  });
  const all = q.data?.pages.flatMap((p) => p.items) ?? [];
  const items = all.filter((m) => filter === "all" || (filter === "win") === m.win);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: "200px" });
    io.observe(el); return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, tab]);
  const r = sum.data?.rank;
  if (!id) return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Profile</h1>
    <p className="text-sm text-muted mb-6">Press Ctrl+K to search any Name#TAG, or add your own Riot ID.</p>
    <RiotIdPrompt />
  </>);
  return (<>
    <div className="flex items-start justify-between gap-6 mb-6">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">{id}</h1>
        <p className="text-sm text-muted mt-1">{riotId ? "Profile data." : "Showing your Riot ID (set it in Settings). Press Ctrl+K to search any Name#TAG."}</p></div>
      <div>
        <div className="flex gap-2 flex-wrap justify-end">{recent.map((x) => <Chip key={x} onClick={() => nav(`/profile/${encodeURIComponent(x)}`)}>{x}</Chip>)}</div></div>
    </div>
    {sum.isError ? <div className="glass rounded-lg p-8 text-sm text-bad">{(sum.error as Error).message}</div> : <>
      <div className="glass rounded-lg p-5 flex items-center gap-5 max-w-md">
        {r ? <><ProgressRing value={r.lp} label="LP" text={`${r.lp} LP`} /><TierIcon tier={r.tier} division={r.division} size={44} /><div>
          <div className="font-display text-xl font-semibold">{r.tier[0] + r.tier.slice(1).toLowerCase()} {r.division}</div>
          <div className="text-xs text-muted">{r.lp} LP · {r.wins}W {r.losses}L · Level {sum.data!.level}{sum.data!.platform ? ` · ${sum.data!.platform.toUpperCase()}` : ""}</div></div></> : sum.data ? <div className="text-sm text-muted">Unranked in Ranked Solo/Duo</div> : <Skeleton className="h-20 w-full" />}
      </div>
      <div className="mt-6"><Tabs id="profile" value={tab} onChange={setTab} tabs={[{ key: "matches", label: "Match history" }, { key: "lp", label: "LP history" }, { key: "mastery", label: "Mastery" }] } /></div>
      {tab === "mastery" && <MasteryTab id={id} />}
      {tab === "lp" && <LpHistoryTab id={id} />}
      {tab === "matches" && <>
      <div className="mt-4"><QueueFilterChips value={queue} onChange={(k) => { setUi({ queueFilter: k }); setOpen(null); }} /></div>
      <div className="flex items-center gap-2 mt-3 mb-3" role="group" aria-label="Result filter">
        {(["all", "win", "loss"] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "win" ? "Wins" : "Losses"}</Chip>)}
        <span className="text-xs text-muted ml-2">{all.length} games loaded</span>
      </div>
      <ul className="space-y-2">
        {q.isError && <li className="text-sm text-bad">{(q.error as Error).message}</li>}
        {q.isLoading && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}
        {items.map((m) => <MatchRow key={m.id} riotId={id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />)}
      </ul>
      <div ref={sentinel} className="h-10 grid place-items-center text-xs text-muted">
        {isFetchingNextPage ? "Loading more…" : hasNextPage ? "" : all.length ? "End of history" : q.isSuccess ? `No ${QUEUE_FILTERS.find((f) => f.key === queue)?.label ?? ""} games in your match history.` : ""}</div>
      </>}
    </>}
  </>);
}

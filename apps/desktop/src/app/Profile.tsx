import { useInfiniteQuery } from "@tanstack/react-query";
import { TierIcon } from "../components/TierIcon";
import { ChampIcon } from "../components/ChampIcon";
import { LoadoutIcons } from "../components/LoadoutIcons";
import { MatchFilterChips, QueueFilterChips } from "../components/MatchRow";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isQueueFilter, QUEUE_FILTERS } from "@apex/schema";
import { Chip, ProgressRing, Skeleton } from "../components/ui";
import { rankTitle } from "../lib/lpRing";
import { CUTOFF_HINT, useApexRing } from "../lib/useApexRing";
import { api, usePool, useScope, useSummoner } from "../lib/api";
import { useChampName } from "../lib/ddragon";
import { useUi } from "../lib/store";
import { Tabs } from "../components/Tabs";
import { MasteryTab } from "./ProfileTabs";
import { LpHistoryTab } from "./LpHistory";
import { LiveGameView } from "./LiveGameView";
import { RiotIdPrompt } from "../components/RiotIdPrompt";
import { ExpandableMatchRow } from "../components/MatchDetail";
import { ProfileSidebar } from "../components/ProfileSidebar";
import { useMediaQuery } from "../lib/useMediaQuery";

type ProfileTab = "matches" | "overview" | "lp" | "mastery" | "live";

export function Profile() {
  const { riotId } = useParams(), me = useUi((s) => s.myRiotId), id = riotId ? decodeURIComponent(riotId) : me;
  const recent = useUi((s) => s.recent), nav = useNavigate();
  const sum = useSummoner(id);
  const [filter, setFilter] = useState<"all" | "win" | "loss">("all");
  const queue = ((q) => (isQueueFilter(q) ? q : "all"))(useUi((s) => s.queueFilter)), setUi = useUi((s) => s.patch);
  const mf = useUi((s) => s.matchFilter), champName = useChampName(), pool = usePool(id);
  // A champion filter belongs to your own pool: drop it (keep the role) when another player's profile opens or closes. Your own profile and Home share the filter.
  useEffect(() => {
    const dropChampion = () => { const { matchFilter, patch } = useUi.getState(); if (matchFilter.champion) patch({ matchFilter: matchFilter.role ? { role: matchFilter.role } : {} }); };
    if (id !== me) dropChampion();
    return () => { if (id !== me) dropChampion(); };
  }, [id, me]);
  const poolChamps = [...(pool.data ?? [])].map((p) => ({ id: p.champion, name: champName(p.champion) })).sort((a, b) => a.name.localeCompare(b.name));
  const [open, setOpen] = useState<string | null>(null);
  // Wide windows show the overview (champion performance, role performance, played with) as a sidebar that starts level with the tabs (below the name and rank card); narrower ones get it as an Overview tab, so the match rows keep their room.
  const wide = useMediaQuery("(min-width: 1600px)");
  const [tabRaw, setTab] = useState<ProfileTab>("matches"), tab: ProfileTab = wide && tabRaw === "overview" ? "matches" : tabRaw;
  const tabs: { key: ProfileTab; label: string }[] = [{ key: "matches", label: "Match history" }, ...(wide ? [] : [{ key: "overview" as const, label: "Overview" }]), { key: "lp", label: "LP history" }, { key: "mastery", label: "Mastery" }, { key: "live", label: "Live game" }];
  const q = useInfiniteQuery({
    queryKey: [useScope(), "matchpages", id, queue, mf.champion ?? "", mf.role ?? ""], initialPageParam: 0,
    queryFn: ({ pageParam }) => api.getMatchPage(id, pageParam, 10, queue, mf),
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
  const r = sum.data?.rank, ring = useApexRing(r, sum.data?.platform);
  if (!id) return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Profile</h1>
    <p className="text-sm text-muted mb-6">Press Ctrl+K to search any Name#TAG, or add your own Riot ID.</p>
    <RiotIdPrompt />
  </>);
  return (<div>
    <div className="flex items-start justify-between gap-6 mb-6">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">{id}</h1>
        <p className="text-sm text-muted mt-1">{riotId ? "Profile data." : "Showing your Riot ID (set it in Settings). Press Ctrl+K to search any Name#TAG."}</p></div>
      <div>
        <div className="flex gap-2 flex-wrap justify-end">{recent.map((x) => <Chip key={x} onClick={() => nav(`/profile/${encodeURIComponent(x)}`)}>{x}</Chip>)}</div></div>
    </div>
    {sum.isError ? <div className="glass rounded-lg p-8 text-sm text-bad">{(sum.error as Error).message}</div> : <>
      <div className="glass rounded-lg p-5 flex items-center gap-5 max-w-md">
        {r ? <><ProgressRing value={ring!.value} tone={ring!.full ? "gold" : "accent"} aria={ring!.label} text={`${r.lp} LP`} /><TierIcon tier={r.tier} division={r.division} size={44} /><div>
          <div className="font-display text-xl font-semibold">{rankTitle(r.tier, r.division)}</div>
          <div className="text-xs text-muted">{r.lp} LP · {r.wins}W {r.losses}L · Level {sum.data!.level}{sum.data!.platform ? ` · ${sum.data!.platform.toUpperCase()}` : ""}</div>
            {ring!.note && <div className="text-xs text-muted" title={CUTOFF_HINT}>{ring!.note}</div>}</div></> : sum.data ? <div className="text-sm text-muted">Unranked in Ranked Solo/Duo</div> : <Skeleton className="h-20 w-full" />}
      </div>
      <div className={wide ? "mt-6 grid grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start" : "mt-6"}><div className="min-w-0">
      <Tabs id="profile" value={tab} onChange={setTab} tabs={tabs} />
      {tab === "overview" && <ProfileSidebar id={id} queue={queue} stacked />}
      {tab === "mastery" && <MasteryTab id={id} />}
      {tab === "live" && <div className="mt-4"><LiveGameView id={id} refresh /></div>}
      {tab === "lp" && <LpHistoryTab id={id} />}
      {tab === "matches" && <>
      <div className="mt-4"><QueueFilterChips value={queue} onChange={(k) => { setUi({ queueFilter: k }); setOpen(null); }} /></div>
      <div className="mt-3"><MatchFilterChips value={mf} champions={poolChamps} onChange={(f) => { setUi({ matchFilter: f }); setOpen(null); }} /></div>
      <div className="flex items-center gap-2 mt-3 mb-3" role="group" aria-label="Result filter">
        {(["all", "win", "loss"] as const).map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "win" ? "Wins" : "Losses"}</Chip>)}
        <span className="text-xs text-muted ml-2">{all.length} games loaded</span>
      </div>
      <ul className="space-y-2">
        {q.isError && <li className="text-sm text-bad">{(q.error as Error).message}</li>}
        {q.isLoading && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}
        {items.map((m) => <ExpandableMatchRow key={m.id} riotId={id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} />)}
      </ul>
      <div ref={sentinel} className="h-10 grid place-items-center text-xs text-muted">
        {isFetchingNextPage ? "Loading more…" : hasNextPage ? "" : all.length ? "End of history" : q.isSuccess ? `No ${QUEUE_FILTERS.find((f) => f.key === queue)?.label ?? ""} games${mf.champion || mf.role ? " for this champion/role" : ""} in your match history.` : ""}</div>
      </>}
      </div>{wide && <ProfileSidebar id={id} queue={queue} />}</div>
    </>}
  </div>);
}

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LadderRow, LadderTier } from "@apex/schema";
import { ChampIconLink } from "../components/ChampLink";
import { LowBadge, pct, rate, wrClass } from "../components/StatRows";
import { TierIcon } from "../components/TierIcon";
import { Button, Chip, Skeleton, spring } from "../components/ui";
import { useLadder, useLadderPlayer, useSummoner } from "../lib/api";
import { PAGE_SIZE, defaultRegion, pageCount, pageLabel } from "../lib/leaderboard";
import { PLATFORMS, platformName, tierName } from "../lib/platforms";
import { useUi } from "../lib/store";

const TIERS: LadderTier[] = ["CHALLENGER", "GRANDMASTER", "MASTER"];
/** One column layout for the header and every row: rank, player, LP, top champions, win rate. */
const COLS = "grid grid-cols-[3rem_minmax(0,1fr)_5.5rem_8.5rem_13rem] items-center gap-3";
const sel = "focus-ring h-8 px-2 rounded-md bg-raised border border-line/10 text-sm";
const REGIONS = PLATFORMS.map((p) => p[0]);

/** True once the element has come near the screen (and stays true). Rows ask Riot for their name and champions only then, so a page never costs 100 calls at once. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null), [seen, setSeen] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function Row({ row, platform }: { row: LadderRow; platform: string }) {
  const [ref, seen] = useSeen<HTMLLIElement>(), q = useLadderPlayer(platform, row.puuid, seen), p = q.data;
  const games = row.wins + row.losses, r = rate(row.wins, games), [name, tag] = (p?.riotId ?? "").split("#"), top = p?.champions.slice(0, 3) ?? [];
  const waiting = !p && (!seen || q.isLoading);
  return (
    <motion.li ref={ref} variants={{ h: { opacity: 0, y: 6 }, s: { opacity: 1, y: 0 } }} whileHover={{ y: -1 }} transition={spring}
      className={`glass relative rounded-lg px-3 py-2.5 ${COLS} ${p?.riotId ? "hover:bg-raised/40" : ""}`}>
      <div className={`text-right tabular-nums font-display text-lg ${row.rank <= 3 ? "text-gold" : "text-muted"}`}><span className="sr-only">Rank </span>{row.rank}</div>
      <div className="flex items-center gap-2.5 min-w-0">
        <span title={tierName(row.tier)} className="shrink-0"><TierIcon tier={row.tier} division="I" size={30} /><span className="sr-only">{tierName(row.tier)}</span></span>
        <div className="min-w-0">
          {p?.riotId
            // The link stretches over the whole row (after:inset-0), so the row is the click target; the champion icons sit above it (z-10).
            ? <Link to={`/profile/${encodeURIComponent(p.riotId)}`} className="focus-ring rounded block truncate text-sm font-medium hover:underline after:absolute after:inset-0">{name}<span className="font-normal text-muted">#{tag}</span></Link>
            : waiting ? <Skeleton className="h-4 w-32" />
            : <span className="block truncate text-sm text-muted" title="Riot did not return this player's name">Unknown player</span>}
          <div className="text-xs text-muted">{tierName(row.tier)}</div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 text-sm tabular-nums font-medium">
        {row.hotStreak && <span title="Riot marks this player as on a win streak"><Flame size={14} className="text-gold" aria-hidden /><span className="sr-only">Hot streak</span></span>}
        {row.lp.toLocaleString()}<span className="text-xs font-normal text-muted">LP</span>
      </div>
      <div className="relative z-10 flex items-center gap-1.5">
        {waiting ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-8 rounded-md" />) : top.map((c) => <ChampIconLink key={c.champion} id={c.champion} name={c.name} size={32} />)}
        {top.length > 0 && <span className="sr-only">Top mastery: {top.map((c) => `${c.name} ${c.points.toLocaleString()} points`).join(", ")}</span>}
      </div>
      <div className="min-w-0" title={`Raw ${pct(r.raw)} over ${games.toLocaleString()} ranked games this season. Adjusted for sample size.`}>
        <div className="flex items-baseline gap-2 text-xs tabular-nums whitespace-nowrap">
          <span className={`text-sm font-medium ${wrClass(r.adj)}`}>{pct(r.adj)}</span>
          <span className="text-muted">{row.wins}W {row.losses}L</span><LowBadge games={games} />
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-bad/40 overflow-hidden" aria-hidden><div className="h-full bg-good/70" style={{ width: `${r.raw * 100}%` }} /></div>
      </div>
    </motion.li>);
}

/**
 * Leaderboard (L.3): the Master+ ladder of one region, Solo/Duo or Flex, filtered by tier, 50 players a page. The list itself comes from Riot's ladder
 * (cached 10 minutes by the backend); names and top champions load per row once it is near the screen. Champions are the highest mastery points
 * (all time), not the most played this season: Riot has no such number without reading every player's matches.
 */
export function Leaderboard() {
  const mine = useSummoner(useUi((s) => s.myRiotId)).data?.platform, statsPlatform = useUi((s) => s.statsFilter.platform);
  const [picked, setPicked] = useState<string | null>(null), [queue, setQueue] = useState<"solo" | "flex">("solo"), [tiers, setTiers] = useState<LadderTier[]>(TIERS), [page, setPage] = useState(0);
  const platform = picked ?? defaultRegion(mine, statsPlatform, REGIONS), { data, isError, error, isFetching, isPlaceholderData } = useLadder(platform, queue, tiers, page * PAGE_SIZE, PAGE_SIZE);
  const top = useRef<HTMLDivElement>(null), first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } top.current?.scrollIntoView({ block: "start" }); }, [page]);
  const toggle = (t: LadderTier) => { const next = tiers.includes(t) ? tiers.filter((x) => x !== t) : TIERS.filter((x) => x === t || tiers.includes(x)); if (next.length) { setTiers(next); setPage(0); } };
  const pages = pageCount(data?.total ?? 0), at = data ? new Date(data.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return (<>
    <div ref={top} />
    <h1 className="font-display text-3xl font-semibold tracking-tight">Leaderboard</h1>
    <p className="text-sm text-muted mt-1 mb-5" title="Riot re-cuts Challenger and Grandmaster once a day and LP moves in between, so tiers can differ a little from the client.">
      {platformName(platform)} · Master+ by LP{at ? ` · updated ${at}` : ""}
    </p>
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex gap-2" role="group" aria-label="Queue">
        <Chip active={queue === "solo"} onClick={() => { setQueue("solo"); setPage(0); }}>Solo/Duo</Chip>
        <Chip active={queue === "flex"} onClick={() => { setQueue("flex"); setPage(0); }}>Flex</Chip>
      </div>
      <span className="w-px h-5 bg-line/10 mx-1" aria-hidden />
      <div className="flex gap-2" role="group" aria-label="Tier">
        {TIERS.map((t) => <Chip key={t} active={tiers.includes(t)} onClick={() => toggle(t)}><span className="inline-flex items-center gap-1.5"><TierIcon tier={t} division="I" size={16} />{tierName(t)}</span></Chip>)}
      </div>
      <select aria-label="Region" className={`${sel} ml-auto`} value={platform} onChange={(e) => { setPicked(e.target.value); setPage(0); }}>
        {PLATFORMS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </div>
    <div className={`${COLS} px-3 pb-1.5 text-xs text-muted`} aria-hidden>
      <div className="text-right">#</div><div>Player</div><div className="text-right">LP</div>
      <div title="Highest champion mastery points of all time, not the most played this season">Top champions</div><div>Win rate</div>
    </div>
    {isError && <div role="alert" className="glass rounded-lg p-8 text-sm text-bad text-center">{(error as Error).message}</div>}
    {!data && !isError && <div className="grid gap-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[58px]" />)}</div>}
    {data && data.entries.length === 0 && <div className="glass rounded-lg p-8 text-sm text-muted text-center">No players in this selection{queue === "flex" ? " (Flex has far fewer Master+ players)" : ""}.</div>}
    {data && data.entries.length > 0 && <motion.ol key={`${data.queue}-${data.offset}-${data.entries[0].puuid}`} initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.012 } } }}
      aria-label="Leaderboard" className={`grid gap-2 transition-opacity ${isFetching && isPlaceholderData ? "opacity-60" : ""}`}>
      {data.entries.map((r) => <Row key={r.puuid} row={r} platform={data.platform} />)}
    </motion.ol>}
    {data && data.total > PAGE_SIZE && <nav aria-label="Pages" className="flex items-center justify-center gap-4 mt-5 text-sm">
      <Button type="button" variant="ghost" onClick={() => setPage(page - 1)} disabled={page === 0}>Previous</Button>
      <span className="tabular-nums text-muted" aria-live="polite">{pageLabel(data.offset, data.entries.length, data.total)} · page {page + 1} of {pages}</span>
      <Button type="button" variant="ghost" onClick={() => setPage(page + 1)} disabled={page + 1 >= pages}>Next</Button>
    </nav>}
  </>);
}

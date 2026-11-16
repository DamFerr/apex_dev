import { motion } from "framer-motion";
import { TierIcon } from "../components/TierIcon";
import { Radio, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { LiveGame as Game, LivePlayer } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { LowBadge, pct, rate } from "../components/StatRows";
import { Button, Skeleton, spring } from "../components/ui";
import { useLiveGame } from "../lib/api";
import { RIOT_ID_RE } from "../lib/riotId";
import { tierName } from "../lib/platforms";
import { useUi } from "../lib/store";
import { toast } from "../lib/toast";

const rankText = (r: LivePlayer["rank"]) => (!r ? "Unranked" : ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? `${tierName(r.tier)} ${r.lp} LP` : `${tierName(r.tier)} ${r.division}`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function PlayerCard({ p }: { p: LivePlayer }) {
  const season = p.rank ? rate(p.rank.wins, p.rank.wins + p.rank.losses) : null, champ = p.champGames > 0 ? rate(p.champWins, p.champGames) : null;
  const name = p.riotId.split("#")[0];
  return (
    <motion.li variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} transition={spring}
      className={`glass rounded-lg p-3 flex items-center gap-3 ${p.isYou ? "ring-1 ring-gold/60" : ""}`} aria-label={`${p.riotId} playing ${p.championName}`}>
      <ChampIcon id={p.champion} name={p.championName} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          {p.riotId.includes("#") ? <Link to={`/profile/${encodeURIComponent(p.riotId)}`} className="focus-ring rounded truncate font-medium hover:underline">{name}</Link> : <span className="truncate text-muted">{p.riotId}</span>}
          {p.isYou && <span className="rounded-full bg-gold/15 text-gold text-[10px] px-2 py-0.5">you</span>}
          {p.jungle && <span className="rounded-full bg-accent/20 text-[10px] px-2 py-0.5" title="Carries Smite">jungle</span>}
          {p.hotStreak && <span className="rounded-full bg-good/15 text-good text-[10px] px-2 py-0.5" title="Riot marks this player as on a win streak">hot streak</span>}
        </div>
        <div className="text-xs text-muted truncate">{p.championName}</div>
      </div>
      <div className="flex items-center justify-end gap-2 text-right text-xs shrink-0 w-44">
        {p.rank && <TierIcon tier={p.rank.tier} division={p.rank.division} size={28} />}<div>
        <div className="font-medium text-sm">{rankText(p.rank)}</div>
        <div className="text-muted tabular-nums" title={season ? `Raw ${pct(season.raw)} over ${p.rank!.wins + p.rank!.losses} ranked games. Adjusted for sample size.` : undefined}>
          {season && p.rank ? `${p.rank.wins}W ${p.rank.losses}L · ${pct(season.adj, 0)}` : "no ranked games"}</div>
      </div></div>
      <div className="text-right text-xs shrink-0 w-24" title="Win rate of everyone on this champion in the games Apex has collected (current patch)">
        {champ ? <><div className={`tabular-nums font-medium text-sm ${champ.adj >= 0.5 ? "text-good" : "text-bad"}`}>{pct(champ.adj)}<LowBadge games={p.champGames} /></div><div className="text-muted">champion</div></>
          : <div className="text-muted">no champion data</div>}
      </div>
    </motion.li>);
}

function Team({ game, side }: { game: Game; side: "blue" | "red" }) {
  const players = game.players.filter((p) => p.team === side), bans = game.bans.filter((b) => b.team === side);
  return (
    <section aria-label={`${side === "blue" ? "Blue" : "Red"} team`}>
      <h2 className={`font-display text-lg font-semibold mb-2 ${side === "blue" ? "text-accent" : "text-bad"}`}>{side === "blue" ? "Blue team" : "Red team"}</h2>
      <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.04 } } }} className="grid gap-2">{players.map((p, i) => <PlayerCard key={`${p.riotId}-${i}`} p={p} />)}</motion.ul>
      {bans.length > 0 && <p className="text-xs text-muted mt-2">Bans: {bans.map((b) => b.championName).join(", ")}</p>}
    </section>);
}

export function LiveGame() {
  const me = useUi((s) => s.myRiotId), addRecent = useUi((s) => s.addRecent), nav = useNavigate();
  const { riotId } = useParams(), id = riotId ? decodeURIComponent(riotId) : me, [v, setV] = useState(id);
  useEffect(() => setV(id), [id]);
  const q = useLiveGame(id);
  const submit = (e: FormEvent) => {
    e.preventDefault(); const next = v.trim();
    if (!RIOT_ID_RE.test(next)) return toast("Enter a Riot ID like Name#TAG", "error");
    addRecent(next); nav(`/live/${encodeURIComponent(next)}`);
  };
  const g = q.data;
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Live Game</h1>
    <p className="text-sm text-muted mt-1 mb-5">See who is in a game right now: rank and champion form for all ten players. Only information the game&apos;s loading screen already shows, plus public rank data.</p>
    <form onSubmit={submit} role="search" className="flex flex-wrap items-center gap-2 mb-5">
      <input aria-label="Riot ID to scout" value={v} onChange={(e) => setV(e.target.value)} placeholder="Name#TAG"
        className="focus-ring h-10 w-72 px-3 rounded-md bg-raised/60 border border-line/10 text-sm placeholder:text-muted" />
      <Button type="submit"><Radio size={15} />Look up</Button>
      <Button type="button" variant="ghost" onClick={() => void q.refetch()} disabled={q.isFetching}><RefreshCw size={15} className={q.isFetching ? "animate-spin" : ""} />Refresh</Button>
    </form>
    {!id && <div className="glass rounded-lg p-6 text-sm text-muted max-w-xl">Enter a Riot ID above, or add your own in Settings.</div>}
    {q.isLoading && <div className="grid grid-cols-2 gap-6">{[0, 1].map((c) => <div key={c} className="grid gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[66px]" />)}</div>)}</div>}
    {q.isError && <div role="alert" className="glass rounded-lg p-6 text-sm text-bad max-w-xl">{(q.error as Error).message}</div>}
    {g && !g.inGame && <div className="glass rounded-lg p-8 text-sm max-w-xl"><div className="font-medium mb-1">{id.split("#")[0]} is not in a game right now.</div>
      <div className="text-muted">Spectator data appears a minute or two after a game starts. Press Refresh, or scout another Riot ID.</div></div>}
    {g?.inGame && <>
      <div className="flex items-center gap-3 text-sm text-muted mb-4"><span className="rounded-full bg-good/15 text-good text-xs px-2 py-0.5">live</span><span>{g.queue}</span><span aria-label="Game time" className="tabular-nums">{mmss(g.lengthSec)} in</span><span>updates every 30 s</span></div>
      <div className="grid grid-cols-2 gap-6"><Team game={g} side="blue" /><Team game={g} side="red" /></div>
    </>}
  </>);
}

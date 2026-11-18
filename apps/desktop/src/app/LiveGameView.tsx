import { motion } from "framer-motion";
import { TierIcon } from "../components/TierIcon";
import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { LiveGame as Game, LivePlayer } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { GameIcon } from "../components/GameIcon";
import { LowBadge, pct, rate, wrClass } from "../components/StatRows";
import { Button, Skeleton, spring } from "../components/ui";
import { useLiveGame } from "../lib/api";
import { tierName } from "../lib/platforms";

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
        {/* The player's own slot order (D, F), exactly as the spectator data reports it: not rearranged to put Flash first. */}
        {p.spells.length > 0 && <div className="flex gap-0.5 mt-1" role="group" aria-label="Summoner spells">{p.spells.map((id, i) => <GameIcon key={i} kind="spell" id={id} size={20} />)}</div>}
      </div>
      <div className="flex items-center justify-end gap-2 text-right text-xs shrink-0 w-44">
        {p.rank && <TierIcon tier={p.rank.tier} division={p.rank.division} size={28} />}<div>
        <div className="font-medium text-sm">{rankText(p.rank)}</div>
        <div className="text-muted tabular-nums" title={season ? `Raw ${pct(season.raw)} over ${p.rank!.wins + p.rank!.losses} ranked games. Adjusted for sample size.` : undefined}>
          {season && p.rank ? <>{p.rank.wins}W {p.rank.losses}L · <span className={wrClass(season.adj)}>{pct(season.adj, 0)}</span></> : "no ranked games"}</div>
      </div></div>
      <div className="text-right text-xs shrink-0 w-24" title="Win rate of everyone on this champion in the games Apex has collected (current patch)">
        {champ ? <><div className={`tabular-nums font-medium text-sm ${wrClass(champ.adj)}`}>{pct(champ.adj)}<LowBadge games={p.champGames} /></div><div className="text-muted">champion</div></>
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

/**
 * The live game of one player: both teams, ranks and champion form. Used by the Draft tab (you), the Profile tab (anyone) and the scout page.
 * `watch`: the League client says a game is starting or running, so keep asking Riot every 20 s until its spectator data appears
 * (that takes a minute or two after the start; a running game is refreshed every 30 s by `useLiveGame` itself).
 * `refresh`: show a Refresh button (the scout page has its own).
 */
export function LiveGameView({ id, watch = false, refresh = false }: { id: string; watch?: boolean; refresh?: boolean }) {
  const q = useLiveGame(id), g = q.data, { refetch } = q;
  useEffect(() => {
    if (!watch || !id || g?.inGame) return;
    const t = setInterval(() => void refetch(), 20_000);
    return () => clearInterval(t);
  }, [watch, id, g?.inGame, refetch]);
  return (<>
    {refresh && <div className="mb-4"><Button type="button" variant="ghost" onClick={() => void refetch()} disabled={q.isFetching}><RefreshCw size={15} className={q.isFetching ? "animate-spin" : ""} />Refresh</Button></div>}
    {q.isLoading && <div className="grid grid-cols-2 gap-6">{[0, 1].map((c) => <div key={c} className="grid gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[66px]" />)}</div>)}</div>}
    {q.isError && <div role="alert" className="glass rounded-lg p-6 text-sm text-bad max-w-xl">{(q.error as Error).message}</div>}
    {g && !g.inGame && <div className="glass rounded-lg p-8 text-sm max-w-xl"><div className="font-medium mb-1">{id.split("#")[0]} is not in a game right now.</div>
      <div className="text-muted">{watch ? "Your game is starting. Riot's spectator data appears a minute or two after the start, and this page checks again by itself." : "Spectator data appears a minute or two after a game starts. Press Refresh, or scout another Riot ID."}</div></div>}
    {g?.inGame && <>
      <div className="flex items-center gap-3 text-sm text-muted mb-4"><span className="rounded-full bg-good/15 text-good text-xs px-2 py-0.5">live</span><span>{g.queue}</span><span aria-label="Game time" className="tabular-nums">{mmss(g.lengthSec)} in</span><span>updates every 30 s</span></div>
      <div className="grid grid-cols-2 gap-6"><Team game={g} side="blue" /><Team game={g} side="red" /></div>
    </>}
  </>);
}

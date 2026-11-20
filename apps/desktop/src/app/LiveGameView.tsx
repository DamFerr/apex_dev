import { motion } from "framer-motion";
import { TierIcon } from "../components/TierIcon";
import { Ban, RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import type { LiveGame as Game, LivePlayer, Role } from "@apex/schema";
import { ChampIcon } from "../components/ChampIcon";
import { GameIcon } from "../components/GameIcon";
import { ROLE_LABEL, RoleIcon } from "../components/RoleIcon";
import { LowBadge, pct, rate, wrClass } from "../components/StatRows";
import { Button, Skeleton, spring } from "../components/ui";
import { useLiveGame } from "../lib/api";
import { assignRoles, sortByRole } from "../lib/liveRoles";
import { tierName } from "../lib/platforms";
import { useDraftData } from "./DraftContext";

const rankText = (r: LivePlayer["rank"]) => (!r ? "Unranked" : ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? `${tierName(r.tier)} ${r.lp} LP` : `${tierName(r.tier)} ${r.division}`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function PlayerCard({ p, role }: { p: LivePlayer; role: Role | null }) {
  const season = p.rank ? rate(p.rank.wins, p.rank.wins + p.rank.losses) : null, champ = p.champGames > 0 ? rate(p.champWins, p.champGames) : null;
  const name = p.riotId.split("#")[0];
  return (
    <motion.li variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} transition={spring}
      className={`glass rounded-lg p-3 flex items-center gap-3 ${p.isYou ? "ring-1 ring-gold/60" : ""}`} aria-label={`${p.riotId} playing ${p.championName}`}>
      <ChampIcon id={p.champion} name={p.championName} size={44} />
      {role && <span className="shrink-0" title={`${ROLE_LABEL[role]} (estimated: the spectator data has no role field, Apex fits it from Smite and the champion's usual roles)`}><RoleIcon role={role} size={22} /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          {p.riotId.includes("#") ? <Link to={`/profile/${encodeURIComponent(p.riotId)}`} className="focus-ring rounded truncate font-medium hover:underline">{name}</Link> : <span className="truncate text-muted">{p.riotId}</span>}
          {p.isYou && <span className="sr-only">you</span>}
          {p.hotStreak && <span className="rounded-full bg-good/15 text-good text-[10px] font-semibold tracking-wide px-2 py-0.5" title="Riot marks this player as on a win streak">HOT STREAK</span>}
        </div>
        <div className="text-xs text-muted truncate">{p.championName}</div>
        {/* The player's own slot order (D, F), exactly as the spectator data reports it: not rearranged to put Flash first. */}
        {(p.spells.length > 0 || p.keystone !== null) && <div className="flex items-center gap-0.5 mt-1">
          {p.spells.length > 0 && <div className="flex gap-0.5" role="group" aria-label="Summoner spells">{p.spells.map((id, i) => <GameIcon key={i} kind="spell" id={id} size={20} />)}</div>}
          {/* Keystone and secondary tree, as the spectator data reports them (the tree icon is smaller and dimmer, like in the match rows). */}
          {p.keystone !== null && <div className="flex items-center gap-0.5 ml-1.5" role="group" aria-label="Runes"><GameIcon kind="rune" id={p.keystone} size={20} />{p.secondaryStyle !== null && <GameIcon kind="rune" id={p.secondaryStyle} size={16} className="opacity-70" />}</div>}
        </div>}
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

function Team({ game, side, roles }: { game: Game; side: "blue" | "red"; roles: Map<LivePlayer, Role | null> }) {
  const players = sortByRole(game.players.filter((p) => p.team === side), (p) => roles.get(p) ?? null), bans = game.bans.filter((b) => b.team === side);
  return (
    <section aria-label={`${side === "blue" ? "Blue" : "Red"} team`}>
      <h2 className={`font-display text-lg font-semibold mb-2 ${side === "blue" ? "text-accent" : "text-bad"}`}>{side === "blue" ? "Blue team" : "Red team"}</h2>
      <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.04 } } }} className="grid gap-2">{players.map((p, i) => <PlayerCard key={`${p.riotId}-${i}`} p={p} role={roles.get(p) ?? null} />)}</motion.ul>
      {bans.length > 0 && <div className="flex items-center gap-1.5 mt-3" role="group" aria-label={`${side === "blue" ? "Blue" : "Red"} team bans`}>
        <Ban size={14} className="text-muted mr-0.5" aria-hidden />
        {bans.map((b, i) => <span key={`${b.champion}-${i}`} title={`Banned: ${b.championName}`} className="opacity-80"><ChampIcon id={b.champion} name={b.championName} size={28} /></span>)}
      </div>}
    </section>);
}

/**
 * The live game of one player: both teams, ranks and champion form. Used by the Draft tab (you), the Profile tab (anyone) and the scout page.
 * `watch`: the League client says a game is starting or running, so keep asking Riot every 20 s until its spectator data appears
 * (that takes a minute or two after the start; a running game is refreshed every 30 s by `useLiveGame` itself).
 * `refresh`: show a Refresh button (the scout page has its own).
 */
export function LiveGameView({ id, watch = false, refresh = false }: { id: string; watch?: boolean; refresh?: boolean }) {
  const q = useLiveGame(id), g = q.data, { refetch } = q, { champs, data } = useDraftData();
  // Estimated roles per team, only on Summoner's Rift (CLASSIC). Needs the collected games for the champions' usual roles; without them only Smite shows the jungler.
  const roles = useMemo(() => {
    const out = new Map<LivePlayer, Role | null>();
    if (!g?.inGame || g.mode !== "CLASSIC") return out;
    const key = new Map((champs ?? []).map((c) => [c.id, c.key]));
    for (const side of ["blue", "red"] as const) {
      const team = g.players.filter((p) => p.team === side);
      assignRoles(team.map((p) => ({ roles: data && key.has(p.champion) ? data.roles(key.get(p.champion)!) : [], smite: p.jungle, spells: p.spells }))).forEach((r, i) => out.set(team[i], r));
    }
    return out;
  }, [g, champs, data]);
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
      <div className="flex items-center gap-3 text-sm text-muted mb-4"><span className="rounded-full bg-good/15 text-good text-xs font-semibold tracking-wide px-2 py-0.5">LIVE</span><span>{g.queue}</span><span aria-label="Game time" className="tabular-nums">{mmss(g.lengthSec)} in</span><span>updates every 30 s</span></div>
      <div className="grid grid-cols-2 gap-6"><Team game={g} side="blue" roles={roles} /><Team game={g} side="red" roles={roles} /></div>
    </>}
  </>);
}

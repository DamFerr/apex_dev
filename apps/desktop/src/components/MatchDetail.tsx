import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { MatchSummary } from "@apex/schema";
import { api, useScope } from "../lib/api";
import { useChampName } from "../lib/ddragon";
import { profilePath } from "../lib/nav";
import { ChampIcon } from "./ChampIcon";
import { LoadoutIcons } from "./LoadoutIcons";
import { MatchRowBody } from "./MatchRow";
import { Skeleton } from "./ui";

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
              <td><span className="inline-flex items-center gap-2"><ChampIcon id={p.champion} name={champName(p.champion)} size={24} /><span>{p.riotId && !p.isYou ? <Link to={profilePath(p.riotId)} className="focus-ring rounded hover:underline" title={`Open ${p.riotId}`}>{p.name}</Link> : p.name} <span className="text-muted">{champName(p.champion)}</span></span></span></td>
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

/** A finished game that expands into the ten-player scoreboard (names link to the players' profiles) and a link to the full recap. Same on Profile and Home. `variants` lets a list stagger it in. */
export function ExpandableMatchRow({ m, open, onToggle, riotId, variants }: { m: MatchSummary; open: boolean; onToggle: () => void; riotId: string; variants?: Variants }) {
  return (
    <motion.li variants={variants} className="glass rounded-lg overflow-hidden">
      <button aria-expanded={open} onClick={onToggle}
        className={`focus-ring w-full min-h-[4.25rem] py-2 px-4 flex items-center border-l-2 text-left ${m.win ? "border-l-good" : "border-l-bad"}`}>
        <MatchRowBody m={m} trailing={<motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={16} className="text-muted" /></motion.span>} />
      </button>
      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }} className="overflow-hidden"><Detail id={m.id} riotId={riotId} />
            <div className="px-4 pb-3"><Link to={`/recap/${encodeURIComponent(riotId)}/${encodeURIComponent(m.id)}`} className="focus-ring text-sm text-accent hover:underline rounded">Open full recap →</Link></div></motion.div>}
      </AnimatePresence>
    </motion.li>
  );
}


import { motion } from "framer-motion";
import { ChampLink, ChampIconLink } from "../components/ChampLink";
import { Skeleton } from "../components/ui";
import { useMastery } from "../lib/api";

export function MasteryTab({ id }: { id: string }) {
  const { data, isError, error } = useMastery(id);
  if (isError) return <div className="glass rounded-lg p-5 mt-4 text-sm text-bad">{(error as Error).message}</div>;
  if (!data) return <div className="space-y-2 mt-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  const max = Math.max(...data.map((m) => m.points));
  return (
    <ul className="space-y-2 mt-4">
      {data.map((m) => (
        <li key={m.champion} className="glass rounded-lg h-14 px-4 flex items-center gap-4">
          <ChampIconLink id={m.champion} name={m.name} size={36} />
          <span className="w-28 font-medium"><ChampLink id={m.champion} name={m.name} /></span>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${m.level >= 7 ? "bg-gold/20 text-gold" : "bg-raised text-muted"}`}>M{m.level}</span>
          <div className="flex-1 h-1.5 rounded-full bg-line/10 overflow-hidden"><motion.div className="h-full bg-accent origin-left" style={{ width: "100%" }} initial={{ scaleX: 0 }} animate={{ scaleX: m.points / max }} transition={{ duration: 0.8, ease: "easeOut" }} /></div>
          <span className="w-24 text-right tabular-nums text-sm">{m.points.toLocaleString()}</span>
        </li>))}
    </ul>
  );
}

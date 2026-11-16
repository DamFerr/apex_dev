import { sampleBadge, shrink, wilson } from "@apex/stats-core";
import type { ReactNode } from "react";
import type { StatLine } from "@apex/schema";

export const pct = (x: number, d = 1) => (x * 100).toFixed(d) + "%";
/** Adjusted (shrunk) win rate plus the 95% Wilson range, so small samples are never overstated. */
export function rate(wins: number, games: number) {
  const [lo, hi] = wilson(wins, games);
  return { adj: shrink(wins, games, 0.5, 50), raw: games ? wins / games : 0, lo, hi, badge: sampleBadge(games) };
}
export function LowBadge({ games }: { games: number }) {
  return sampleBadge(games) === "low" ? <span className="ml-2 rounded-full bg-gold/15 text-gold text-[10px] px-2 py-0.5">low data</span> : null;
}

/** `icon` draws a picture in front of each row's name (the name stays as text). */
export function StatRows({ rows, title, icon }: { rows: StatLine[]; title: string; icon?: (r: StatLine) => ReactNode }) {
  return (
    <table className="w-full text-sm">
      <caption className="text-left font-display text-lg font-semibold pb-2">{title}</caption>
      <thead className="text-xs text-muted"><tr><th className="text-left font-normal">Name</th><th className="font-normal text-right">Games</th><th className="font-normal text-right">Win rate (adjusted)</th><th className="font-normal text-right whitespace-nowrap pl-2">95% range</th></tr></thead>
      <tbody>{rows.map((r) => { const s = rate(r.wins, r.games); return (
        <tr key={r.name} className="h-9 border-t border-line/5">
          <td className="whitespace-nowrap"><span className="inline-flex items-center gap-2 align-middle">{icon?.(r)}<span>{r.name}</span></span><LowBadge games={r.games} /></td>
          <td className="text-right tabular-nums text-muted">{r.games.toLocaleString()}</td>
          <td className={`text-right tabular-nums font-medium ${s.adj >= 0.5 ? "text-good" : "text-bad"}`} title={`Raw ${pct(s.raw)}`}>{pct(s.adj)}</td>
          <td className="text-right tabular-nums text-muted text-xs whitespace-nowrap pl-2">{pct(s.lo, 0)}–{pct(s.hi, 0)}</td>
        </tr>); })}</tbody>
    </table>
  );
}

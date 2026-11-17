import { sampleBadge, shrink, wilson } from "@apex/stats-core";
import type { ReactNode } from "react";
import type { ItemWpa, StatLine } from "@apex/schema";

export const pct = (x: number, d = 1) => (x * 100).toFixed(d) + "%";
/** Adjusted (shrunk) win rate plus the 95% Wilson range, so small samples are never overstated. */
export function rate(wins: number, games: number) {
  const [lo, hi] = wilson(wins, games);
  return { adj: shrink(wins, games, 0.5, 50), raw: games ? wins / games : 0, lo, hi, badge: sampleBadge(games) };
}
export function LowBadge({ games }: { games: number }) {
  return sampleBadge(games) === "low" ? <span className="ml-2 rounded-full bg-gold/15 text-gold text-[10px] px-2 py-0.5">low data</span> : null;
}

/** "+1.8" / "−0.4": a signed number with a real minus sign. */
export const signed = (x: number, d = 1) => `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(d)}`;

/** Win Probability Added in percentage points. Green/red only when the 95% range excludes 0, so a noisy value is never coloured as if it meant something. */
export function Wpa({ w, unit = false }: { w: ItemWpa; unit?: boolean }) {
  const sure = w.lo > 0 ? "text-good" : w.hi < 0 ? "text-bad" : "text-muted";
  return <span className={`tabular-nums font-medium ${sure}`} title={`Win probability added: ${signed(w.wpa)} pp (95% range ${signed(w.lo)} to ${signed(w.hi)}). Games with this item vs games without it, same length and same number of finished items; expected win rate without it ${pct(w.expected)}. A correlation, not proof.`}>{signed(w.wpa)}{unit ? " pp" : ""}</span>;
}

/** `icon` draws a picture in front of each row's name (the name stays as text). */
export function StatRows({ rows, title, icon }: { rows: StatLine[]; title: string; icon?: (r: StatLine) => ReactNode }) {
  const showWpa = rows.some((r) => r.wpa);
  return (
    <table className="w-full text-sm">
      <caption className="text-left font-display text-lg font-semibold pb-2">{title}</caption>
      <thead className="text-xs text-muted"><tr><th className="text-left font-normal">Name</th><th className="font-normal text-right">Games</th><th className="font-normal text-right">Win rate (adjusted)</th><th className="font-normal text-right whitespace-nowrap pl-2">95% range</th>{showWpa && <th className="font-normal text-right whitespace-nowrap pl-3" title="Win probability added, percentage points">WPA</th>}</tr></thead>
      <tbody>{rows.map((r) => { const s = rate(r.wins, r.games); return (
        <tr key={r.name} className="h-9 border-t border-line/5">
          <td className="whitespace-nowrap"><span className="inline-flex items-center gap-2 align-middle">{icon?.(r)}<span>{r.name}</span></span><LowBadge games={r.games} /></td>
          <td className="text-right tabular-nums text-muted">{r.games.toLocaleString()}</td>
          <td className={`text-right tabular-nums font-medium ${s.adj >= 0.5 ? "text-good" : "text-bad"}`} title={`Raw ${pct(s.raw)}`}>{pct(s.adj)}</td>
          <td className="text-right tabular-nums text-muted text-xs whitespace-nowrap pl-2">{pct(s.lo, 0)}–{pct(s.hi, 0)}</td>
          {showWpa && <td className="text-right whitespace-nowrap pl-3">{r.wpa ? <Wpa w={r.wpa} /> : <span className="text-muted">–</span>}</td>}
        </tr>); })}</tbody>
    </table>
  );
}

import { sampleBadge, shrink, wilson, winRateBand } from "@apex/stats-core";
import type { ReactNode } from "react";
import type { ItemWpa, StatLine } from "@apex/schema";

/** The one win-rate colour class for every screen (see `winRateBand`: bad under 48%, good over 52%). Pass the ADJUSTED win rate as a fraction; always show the number too. */
export const wrClass = (adj: number) => ({ good: "text-good", bad: "text-bad", neutral: "text-text" })[winRateBand(adj)];
export const pct = (x: number, d = 1) => (x * 100).toFixed(d) + "%";
/** Adjusted (shrunk) win rate plus the 95% Wilson range, so small samples are never overstated. */
export function rate(wins: number, games: number) {
  const [lo, hi] = wilson(wins, games);
  return { adj: shrink(wins, games, 0.5, 50), raw: games ? wins / games : 0, lo, hi, badge: sampleBadge(games) };
}
export function LowBadge({ games }: { games: number }) {
  return sampleBadge(games) === "low" ? <span className="ml-2 rounded-full bg-gold/15 text-gold text-[10px] font-semibold tracking-wide px-2 py-0.5">LOW DATA</span> : null;
}

/**
 * A win rate as a BIG coloured number (see `wrClass`) for tables. The details sit in the hover tooltip and, for keyboard and screen reader users, in
 * a hidden sibling: the raw rate, the 95% range and an optional note. Put it inside a `<td>`. `value` is the ADJUSTED win rate as a fraction.
 */
export function WinRateCell({ value, raw, lo, hi, note }: { value: number; raw: number; lo: number; hi: number; note?: string }) {
  const detail = `Raw ${pct(raw)} · 95% range ${pct(lo, 0)}–${pct(hi, 0)}${note ? ` · ${note}` : ""}`;
  return <><span className={`tabular-nums text-[1rem] leading-6 font-semibold ${wrClass(value)}`} title={detail}>{pct(value)}</span><span className="sr-only">{detail}</span></>;
}

/** "+1.8" / "−0.4": a signed number with a real minus sign. */
export const signed = (x: number, d = 1) => { const a = Math.abs(x).toFixed(d); return Number(a) === 0 ? a : `${x < 0 ? "−" : "+"}${a}`; };

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
      <thead className="text-xs text-muted"><tr><th className="text-left font-normal">Name</th><th className="font-normal text-right">Games</th><th className="font-normal text-right" title="Adjusted for small samples. Hover a value for the raw rate and its 95% range.">Win rate</th>{showWpa && <th className="font-normal text-right whitespace-nowrap pl-3" title="Win probability added, percentage points">WPA</th>}</tr></thead>
      <tbody>{rows.map((r) => { const s = rate(r.wins, r.games); return (
        <tr key={r.name} className="h-9 border-t border-line/5">
          <td className="whitespace-nowrap"><span className="inline-flex items-center gap-2 align-middle">{icon?.(r)}<span>{r.name}</span></span><LowBadge games={r.games} /></td>
          <td className="text-right tabular-nums text-muted">{r.games.toLocaleString()}</td>
          <td className="text-right"><WinRateCell value={s.adj} raw={s.raw} lo={s.lo} hi={s.hi} /></td>
          {showWpa && <td className="text-right whitespace-nowrap pl-3">{r.wpa ? <Wpa w={r.wpa} /> : <span className="text-muted">–</span>}</td>}
        </tr>); })}</tbody>
    </table>
  );
}

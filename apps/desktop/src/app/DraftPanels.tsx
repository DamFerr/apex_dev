import { motion } from "framer-motion";
import { RoleIcon } from "../components/RoleIcon";
import type { BanSuggestion, Evaluation, Factor, Recommendation } from "@apex/draft-engine";
import { ChampIcon } from "../components/ChampIcon";
import { AnimatedNumber, spring } from "../components/ui";
import { champId, champName } from "../lib/lcu";

const sign = (n: number, d = 1) => (n >= 0 ? "+" : "") + n.toFixed(d);
export function describe(f: Factor): string {
  if (f.kind === "matchup") return `${champName(f.champs[0])} vs ${champName(f.champs[1])}`;
  if (f.kind === "synergy") return `${champName(f.champs[0])} + ${champName(f.champs[1])}`;
  return f.label;
}


/** Win probability bar: scaleX only (GPU friendly), eased with a spring as picks lock in. */
export function WinProbability({ ev, source, games }: { ev: Evaluation; source: string; games: number }) {
  const p = ev.winProb;
  return (
    <section className="glass rounded-lg p-4" aria-label="Win probability">
      <div className="flex justify-between text-sm mb-2">
        <span>Your team <b className="font-display text-lg"><AnimatedNumber value={p * 100} suffix="%" /></b></span>
        <span className="text-right"><b className="font-display text-lg"><AnimatedNumber value={(1 - p) * 100} suffix="%" /></b> Enemy</span>
      </div>
      <div className="h-3 rounded-full bg-bad/40 overflow-hidden" role="img" aria-label={`Your team ${(p * 100).toFixed(1)} percent`}>
        <motion.div className="h-full w-full origin-left bg-accent shadow-glow" animate={{ scaleX: p }} transition={spring} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted">
        <span>±{(ev.band * 100).toFixed(1)} pts (heuristic, narrows as picks lock)</span>
        <span>Based on {source}{games < 300 ? ". Few games for these filters, so numbers are rough" : ""}</span>
        {ev.factors.slice(0, 3).map((f, i) => <span key={i} className={f.pp >= 0 ? "text-good" : "text-bad"}>{sign(f.pp)}% {describe(f)}</span>)}
      </div>
    </section>
  );
}

export function Recommendations({ recs, role, source }: { recs: Recommendation[]; role: string; source: string }) {
  return (
    <section className="glass rounded-lg p-4" aria-label="Pick recommendations">
      <div className="font-display text-lg font-semibold mb-3">Suggested picks <span className="text-xs text-muted font-normal inline-flex items-center gap-1.5 align-middle">(<RoleIcon role={role} size={14} decorative />{role} · {source})</span></div>
      <ul className="space-y-2">
        {recs.map((r, i) => (
          <motion.li key={r.champion} layout transition={spring} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 h-11">
            <span className="w-4 text-xs text-muted">{i + 1}</span>
            {champId(r.champion) && <ChampIcon id={champId(r.champion)!} name={champName(r.champion)} size={32} />}
            <span className="w-28 text-sm font-medium truncate">{champName(r.champion)}</span>
            <span className="tabular-nums text-sm w-14">{(r.winProb * 100).toFixed(1)}%</span>
            <span className={`tabular-nums text-xs w-14 ${r.deltaPP >= 0 ? "text-good" : "text-bad"}`}>{sign(r.deltaPP)}</span>
            <span className="text-xs text-muted truncate">{r.why ? `${sign(r.why.pp)}% ${describe(r.why)}` : ""}{r.note && <span className="text-gold"> · {r.note}</span>}</span>
          </motion.li>))}
      </ul>
    </section>
  );
}

export function BanSuggestions({ bans, role, source, pool }: { bans: BanSuggestion[]; role: string; source: string; pool: string }) {
  return (
    <section className="glass rounded-lg p-4 border border-bad/40" aria-label="Ban suggestions">
      <div className="font-display text-lg font-semibold mb-3">Your ban turn <span className="text-xs text-muted font-normal inline-flex items-center gap-1.5 align-middle">(<RoleIcon role={role} size={14} decorative />{role} · {pool} · {source})</span></div>
      <ul className="space-y-2">
        {bans.map((b, i) => (
          <motion.li key={b.champion} layout transition={spring} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 h-11">
            <span className="w-4 text-xs text-muted">{i + 1}</span>
            {champId(b.champion) && <ChampIcon id={champId(b.champion)!} name={champName(b.champion)} size={32} />}
            <span className="w-28 text-sm font-medium truncate">{champName(b.champion)}</span>
            <span className="text-xs text-muted truncate">{b.against ? `Beats your ${champName(b.against)}` : "Strong in general"}</span>
          </motion.li>))}
      </ul>
    </section>
  );
}

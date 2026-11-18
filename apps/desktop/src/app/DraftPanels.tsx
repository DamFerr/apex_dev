import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Role } from "@apex/schema";
import { BuildStrip } from "./DraftBuild";
import { RoleIcon } from "../components/RoleIcon";
import type { BanSuggestion, Evaluation, Factor, Recommendation, TeamComp } from "@apex/draft-engine";
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
  // The build under a suggestion opens on click; the top suggestion starts open. "none" = the person closed it.
  const [open, setOpen] = useState<number | "none" | undefined>(undefined);
  const shown = open === undefined ? recs[0]?.champion : open;
  return (
    <section className="glass rounded-lg p-4" aria-label="Pick recommendations">
      <div className="font-display text-lg font-semibold mb-3">Suggested picks <span className="text-xs text-muted font-normal inline-flex items-center gap-1.5 align-middle">(<RoleIcon role={role} size={14} decorative />{role} · {source})</span></div>
      <ul className="space-y-1">
        {recs.map((r, i) => { const isOpen = shown === r.champion, id = champId(r.champion); return (
          <motion.li key={r.champion} layout transition={spring} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "none" : r.champion)} title={`${isOpen ? "Hide" : "Show"} the suggested build`}
              className="focus-ring w-full flex items-center gap-3 h-11 rounded-md text-left hover:bg-raised/40">
              <span className="w-4 text-xs text-muted">{i + 1}</span>
              {id && <ChampIcon id={id} name={champName(r.champion)} size={32} />}
              <span className="w-28 text-sm font-medium truncate">{champName(r.champion)}</span>
              <span className="tabular-nums text-sm w-14">{(r.winProb * 100).toFixed(1)}%</span>
              <span className={`tabular-nums text-xs w-14 ${r.deltaPP >= 0 ? "text-good" : "text-bad"}`}>{sign(r.deltaPP)}</span>
              <span className="text-xs text-muted truncate">{r.why ? `${sign(r.why.pp)}% ${describe(r.why)}` : ""}{r.note && <span className="text-gold"> · {r.note}</span>}</span>
              <ChevronDown size={14} aria-hidden className={`ml-auto shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && id && <div className="mt-1 mb-2"><BuildStrip id={id} role={role as Role} /></div>}
          </motion.li>); })}
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

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** One team's damage split as a stacked bar. Three full-width layers scaled from the left (GPU friendly): true under magic under physical. */
function DamageBar({ c, label }: { c: TeamComp; label: string }) {
  const empty = c.picks === 0, text = `${label}: ${pct(c.ad)} physical, ${pct(c.ap)} magic${c.trueShare >= 0.005 ? `, ${pct(c.trueShare)} true` : ""}${c.measured ? "" : ", estimated from champion classes"}`;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums">{empty ? "no picks yet" : <><span className="text-gold">AD {pct(c.ad)}</span> · <span className="text-accent">AP {pct(c.ap)}</span>{c.trueShare >= 0.005 && <> · True {pct(c.trueShare)}</>}</>}</span></div>
      <div className="relative h-2.5 rounded-full bg-raised/70 overflow-hidden" role="img" aria-label={text}>
        <motion.div className="absolute inset-0 origin-left bg-text/70" initial={false} animate={{ scaleX: empty ? 0 : 1 }} transition={spring} />
        <motion.div className="absolute inset-0 origin-left bg-accent" initial={false} animate={{ scaleX: empty ? 0 : c.ad + c.ap }} transition={spring} />
        <motion.div className="absolute inset-0 origin-left bg-gold" initial={false} animate={{ scaleX: empty ? 0 : c.ad }} transition={spring} />
      </div>
    </div>
  );
}

/** A per-minute number for both teams, bars relative to the larger one. Only drawn when both teams are measured. */
function Versus({ label, ally, enemy, unit, digits = 0 }: { label: string; ally: number; enemy: number; unit: string; digits?: number }) {
  const top = Math.max(ally, enemy, 1e-9), f = (n: number) => n.toFixed(digits);
  return (
    <div className="text-xs">
      <div className="flex justify-between mb-1"><span className="font-medium">{label}</span><span className="text-muted tabular-nums">you {f(ally)} · enemy {f(enemy)} {unit}</span></div>
      <div className="grid gap-1" role="img" aria-label={`${label}: your team ${f(ally)}, enemy team ${f(enemy)} ${unit}`}>
        {[[ally, "bg-accent"], [enemy, "bg-bad"]].map(([v, c], i) => <div key={i} className="h-1.5 rounded-full bg-raised/70 overflow-hidden"><motion.div className={`h-full w-full origin-left ${c}`} initial={false} animate={{ scaleX: (v as number) / top }} transition={spring} /></div>)}
      </div>
    </div>
  );
}

/** Team composition from the locked picks: damage split (measured from collected games, class estimate otherwise), tankiness and CC. */
export function CompAnalysis({ ally, enemy }: { ally: TeamComp; enemy: TeamComp }) {
  const both = ally.measured && enemy.measured && ally.takenPerMin != null && enemy.takenPerMin != null && ally.ccPerMin != null && enemy.ccPerMin != null;
  const skewed = ([["Your team", ally], ["Enemy team", enemy]] as const).filter(([, c]) => c.picks >= 3 && Math.max(c.ad, c.ap) >= 0.75)
    .map(([n, c]) => `${n} is ${pct(Math.max(c.ad, c.ap))} ${c.ad >= c.ap ? "physical" : "magic"} damage.`);
  const estimated = [ally, enemy].some((c) => c.picks > 0 && !c.measured);
  return (
    <section className="glass rounded-lg p-4" aria-label="Team composition">
      <div className="font-display text-lg font-semibold mb-3">Team composition</div>
      <div className="space-y-3">
        <DamageBar c={ally} label="Your team" /><DamageBar c={enemy} label="Enemy team" />
        {both && <><Versus label="Damage taken" ally={ally.takenPerMin!} enemy={enemy.takenPerMin!} unit="/min" /><Versus label="Crowd control time" ally={ally.ccPerMin!} enemy={enemy.ccPerMin!} unit="s/min" digits={1} /></>}
      </div>
      {skewed.length > 0 && <p className="mt-3 text-xs text-gold" role="status">{skewed.join(" ")} One resistance item goes a long way against it.</p>}
      <p className="mt-3 text-xs text-muted">{estimated
        ? "Estimated from champion classes where a champion has fewer than 20 collected games with damage data. Damage taken and CC appear once both teams are measured."
        : "Measured from collected games: average damage by type per minute, summed over the locked picks."}</p>
    </section>
  );
}

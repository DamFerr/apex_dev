import { Fragment, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RoleIcon } from "../components/RoleIcon";
import type { BanSuggestion, Evaluation, Factor, Recommendation, TeamComp, TeamScaling } from "@apex/draft-engine";
import { ChampIcon } from "../components/ChampIcon";
import { LowBadge } from "../components/StatRows";
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
    <section className="glass rounded-lg p-6" aria-label="Win probability">
      <div className="flex justify-between items-baseline text-[1rem] mb-3">
        <span>Your team <b className="font-display text-3xl ml-2"><AnimatedNumber value={p * 100} suffix="%" /></b></span>
        <span className="text-right"><b className="font-display text-3xl mr-2"><AnimatedNumber value={(1 - p) * 100} suffix="%" /></b> Enemy</span>
      </div>
      <div className="h-4 rounded-full bg-bad/40 overflow-hidden" role="img" aria-label={`Your team ${(p * 100).toFixed(1)} percent`}>
        <motion.div className="h-full w-full origin-left bg-accent shadow-glow" animate={{ scaleX: p }} transition={spring} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-muted">
        <span>±{(ev.band * 100).toFixed(1)} pts (heuristic, narrows as picks lock)</span>
        <span>Based on {source}{games < 300 ? ". Few games for these filters, so numbers are rough" : ""}</span>
        {ev.factors.slice(0, 3).map((f, i) => <span key={i} className={f.pp >= 0 ? "text-good" : "text-bad"}>{sign(f.pp)}% {describe(f)}</span>)}
      </div>
    </section>
  );
}

/** A button that acts in the real League client. Lock in and Ban are final, so they need a second click within 3 s: a stray click does nothing. */
function ActButton({ label, hint, confirm, onAct }: { label: string; hint: string; confirm?: boolean; onAct: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = window.setTimeout(() => setArmed(false), 3000); return () => window.clearTimeout(t); }, [armed]);
  return (
    <button type="button" title={hint} onClick={() => { if (confirm && !armed) { setArmed(true); return; } setArmed(false); onAct(); }}
      className={`focus-ring shrink-0 h-9 px-4 rounded-md text-sm font-medium border ${armed ? "border-bad/60 bg-bad/15 text-bad" : "border-white/10 hover:bg-raised/60"}`}>
      {armed ? "Confirm?" : label}<span className="sr-only">{`, ${hint}`}</span>
    </button>);
}

export function Recommendations({ recs, role, source, onHover, onLock }: { recs: Recommendation[]; role: string; source: string; onHover?: (champion: number) => void; onLock?: (champion: number) => void }) {
  return (
    <section className="glass rounded-lg p-6" aria-label="Pick recommendations">
      <div className="font-display text-xl font-semibold mb-4">Suggested picks <span className="text-sm text-muted font-normal inline-flex items-center gap-1.5 align-middle ml-2">(<RoleIcon role={role} size={16} decorative />{role} · {source})</span></div>
      <ul className="space-y-2">
        {recs.map((r, i) => { const id = champId(r.champion); return (
          <motion.li key={r.champion} layout transition={spring} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-5 min-h-14 py-1.5 px-2">
              <span className="w-5 text-sm text-muted">{i + 1}</span>
              {id && <ChampIcon id={id} name={champName(r.champion)} size={44} />}
              <span className="w-40 shrink-0 text-[1rem] font-medium truncate">{champName(r.champion)}</span>
              <span className="tabular-nums font-display text-xl w-20 shrink-0">{(r.winProb * 100).toFixed(1)}%</span>
              {r.games !== undefined && <span className="tabular-nums text-xs text-muted w-28 shrink-0 whitespace-nowrap" title={`Collected games of ${champName(r.champion)} in ${role} behind this suggestion`}>{r.games.toLocaleString()} games<LowBadge games={r.games} /></span>}
              <span className={`tabular-nums text-sm w-16 shrink-0 ${r.deltaPP >= 0 ? "text-good" : "text-bad"}`}>{sign(r.deltaPP)}</span>
              <span className="text-sm text-muted flex-1 min-w-0">{r.why ? `${sign(r.why.pp)}% ${describe(r.why)}` : ""}{r.note && <span className="text-gold"> · {r.note}</span>}</span>
            </div>
            {onHover && <ActButton label="Hover" hint={`Show ${champName(r.champion)} in your slot in the League client`} onAct={() => onHover(r.champion)} />}
            {onLock && <ActButton label="Lock in" confirm hint={`Lock in ${champName(r.champion)} in the League client`} onAct={() => onLock(r.champion)} />}
            </div>
          </motion.li>); })}
      </ul>
    </section>
  );
}

export function BanSuggestions({ bans, role, source, pool, onHover, onBan }: { bans: BanSuggestion[]; role: string; source: string; pool: string; onHover?: (champion: number) => void; onBan?: (champion: number) => void }) {
  return (
    <section className="glass rounded-lg p-6 border border-bad/40" aria-label="Ban suggestions">
      <div className="font-display text-xl font-semibold mb-4">Your ban turn <span className="text-sm text-muted font-normal inline-flex items-center gap-1.5 align-middle ml-2">(<RoleIcon role={role} size={16} decorative />{role} · {pool} · {source})</span></div>
      <ul className="space-y-2">
        {bans.map((b, i) => (
          <motion.li key={b.champion} layout transition={spring} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-5 min-h-14 px-2">
            <span className="w-5 text-sm text-muted">{i + 1}</span>
            {champId(b.champion) && <ChampIcon id={champId(b.champion)!} name={champName(b.champion)} size={44} />}
            <span className="w-40 shrink-0 text-[1rem] font-medium truncate">{champName(b.champion)}</span>
            <span className="text-sm text-muted flex-1 min-w-0">{b.against ? `Beats your ${champName(b.against)}` : "Strong in general"}</span>
            {(onHover || onBan) && <span className="ml-auto flex items-center gap-2">{onHover && <ActButton label="Hover" hint={`Show ${champName(b.champion)} in your ban slot in the League client`} onAct={() => onHover(b.champion)} />}{onBan && <ActButton label="Ban" confirm hint={`Ban ${champName(b.champion)} in the League client`} onAct={() => onBan(b.champion)} />}</span>}
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm mb-1.5"><span className="font-medium">{label}</span>
        <span className="text-muted tabular-nums whitespace-nowrap">{empty ? "no picks yet" : <><span className="text-gold">AD {pct(c.ad)}</span> · <span className="text-accent">AP {pct(c.ap)}</span>{c.trueShare >= 0.005 && <> · True {pct(c.trueShare)}</>}</>}</span></div>
      <div className="relative h-3 rounded-full bg-raised/70 overflow-hidden" role="img" aria-label={text}>
        <motion.div className="absolute inset-0 origin-left bg-text/70" initial={false} animate={{ scaleX: empty ? 0 : 1 }} transition={spring} />
        <motion.div className="absolute inset-0 origin-left bg-accent" initial={false} animate={{ scaleX: empty ? 0 : c.ad + c.ap }} transition={spring} />
        <motion.div className="absolute inset-0 origin-left bg-gold" initial={false} animate={{ scaleX: empty ? 0 : c.ad }} transition={spring} />
      </div>
    </div>
  );
}

/** One metric for both teams: a heading line (name, LOW DATA, games) and two rows (team, bar, number), so the numbers never fight the label for width. */
const ROWS = "grid grid-cols-[3.25rem_1fr_auto] items-center gap-x-3 gap-y-1.5";
/** A per-minute number for both teams, bars relative to the larger one. Only drawn when both teams are measured. */
function Versus({ label, ally, enemy, unit, digits = 0, games, hint }: { label: string; ally: number; enemy: number; unit: string; digits?: number; games?: number; hint?: string }) {
  const top = Math.max(ally, enemy, 1e-9), f = (n: number) => n.toFixed(digits), show = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (
    <div className="text-sm" title={hint}>
      <div className="flex items-baseline justify-between gap-3 mb-2"><span className="font-medium">{label}{games !== undefined && <LowBadge games={games} />}</span>
        {games !== undefined && <span className="text-xs text-muted tabular-nums whitespace-nowrap">{games.toLocaleString()} games</span>}</div>
      <div className={ROWS} role="img" aria-label={`${label}: your team ${f(ally)}, enemy team ${f(enemy)} ${unit}`}>
        {([["You", ally, "bg-accent"], ["Enemy", enemy, "bg-bad"]] as const).map(([who, v, c]) => <Fragment key={who}>
          <span className="text-xs text-muted">{who}</span>
          <div className="h-2 rounded-full bg-raised/70 overflow-hidden"><motion.div className={`h-full w-full origin-left ${c}`} initial={false} animate={{ scaleX: v / top }} transition={spring} /></div>
          <span className="text-right tabular-nums whitespace-nowrap">{show(v)} <span className="text-xs text-muted">{unit}</span></span>
        </Fragment>)}
      </div>
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  );
}

/** A team average of this many points (late minus early win rate) fills half of a scaling bar. */
const SCALING_BAR_FULL = 0.05;
const signed = (x: number) => `${x < 0 ? "−" : "+"}${Math.abs(x * 100).toFixed(1)}`;

/**
 * Scaling of both teams: late (over 33 min) minus early (under 25 min) win rate of each pick in its role, averaged over the team, in points.
 * Bars grow from the centre: left = early game, right = late game. A correlation (long games are also won by stronger teams), so it says so.
 * LOW DATA follows the thinner team. Only drawn when at least one pick has a measured score.
 */
function ScalingRow({ ally, enemy }: { ally: TeamScaling; enemy: TeamScaling }) {
  const measured = [ally, enemy].filter((t) => t.measuredPicks > 0);
  if (measured.length === 0) return null;
  const detail = `Scaling is the late (over 33 min) minus early (under 25 min) win rate of each pick in its role, averaged over the team's picks; a pick without enough games counts 0. Based on ${ally.games.toLocaleString()} games for your team and ${enemy.games.toLocaleString()} for the enemy. A correlation, not a cause: long games are also won by stronger teams.`;
  return (
    <div className="text-sm" title={detail}>
      <div className="flex items-baseline justify-between gap-3 mb-2"><span className="font-medium">Scaling<span className="ml-2 text-xs text-muted">correlation</span><LowBadge games={Math.min(...measured.map((t) => t.games))} /></span>
        <span className="text-xs text-muted tabular-nums whitespace-nowrap">{ally.games.toLocaleString()} / {enemy.games.toLocaleString()} games</span></div>
      <div className={ROWS} role="img" aria-label={`Scaling, late minus early win rate in points: your team ${signed(ally.score)}, enemy team ${signed(enemy.score)}`}>
        {([["You", ally.score, "bg-accent"], ["Enemy", enemy.score, "bg-bad"]] as const).map(([who, v, c]) => <Fragment key={who}>
          <span className="text-xs text-muted">{who}</span>
          <div className="relative h-2 rounded-full bg-raised/70 overflow-hidden">
            <div className="absolute inset-y-0 left-1/2 w-px bg-text/30" />
            <motion.div className={`absolute inset-y-0 w-1/2 ${v >= 0 ? "left-1/2 origin-left" : "right-1/2 origin-right"} ${c}`} initial={false} animate={{ scaleX: Math.min(1, Math.abs(v) / SCALING_BAR_FULL) }} transition={spring} />
          </div>
          <span className="text-right tabular-nums whitespace-nowrap">{signed(v)} <span className="text-xs text-muted">pts</span></span>
        </Fragment>)}
      </div>
      <span className="sr-only">{detail}</span>
    </div>
  );
}

/** Team composition from the locked picks: damage split (measured from collected games, class estimate otherwise), tankiness and CC. */
export function CompAnalysis({ ally, enemy, allyScaling, enemyScaling }: { ally: TeamComp; enemy: TeamComp; allyScaling?: TeamScaling; enemyScaling?: TeamScaling }) {
  const both = ally.measured && enemy.measured && ally.takenPerMin != null && enemy.takenPerMin != null && ally.ccPerMin != null && enemy.ccPerMin != null;
  const skewed = ([["Your team", ally], ["Enemy team", enemy]] as const).filter(([, c]) => c.picks >= 3 && Math.max(c.ad, c.ap) >= 0.75)
    .map(([n, c]) => `${n} is ${pct(Math.max(c.ad, c.ap))} ${c.ad >= c.ap ? "physical" : "magic"} damage.`);
  const estimated = [ally, enemy].some((c) => c.picks > 0 && !c.measured);
  return (
    <section className="glass rounded-lg p-6" aria-label="Team composition">
      <div className="font-display text-xl font-semibold mb-4">Team composition</div>
      <div className="space-y-4"><DamageBar c={ally} label="Your team" /><DamageBar c={enemy} label="Enemy team" /></div>
      {(both || (ally.peelPerMin != null && enemy.peelPerMin != null) || (allyScaling && enemyScaling)) && <div className="mt-5 space-y-5 border-t border-line/10 pt-5">
        {both && <><Versus label="Damage taken" ally={ally.takenPerMin!} enemy={enemy.takenPerMin!} unit="/min" /><Versus label="Crowd control time" ally={ally.ccPerMin!} enemy={enemy.ccPerMin!} unit="s/min" digits={1} /></>}
        {ally.peelPerMin != null && enemy.peelPerMin != null && <Versus label="Heals and shields" ally={ally.peelPerMin} enemy={enemy.peelPerMin} unit="/min" games={Math.min(ally.peelGames, enemy.peelGames)}
          hint={`Healing and shielding on teammates per minute, summed over the locked picks, measured from collected games that carry it (older games do not). Fewest games behind a pick: ${ally.peelGames.toLocaleString()} for your team, ${enemy.peelGames.toLocaleString()} for the enemy.`} />}
        {allyScaling && enemyScaling && <ScalingRow ally={allyScaling} enemy={enemyScaling} />}
      </div>}
      {skewed.length > 0 && <p className="mt-5 text-sm text-gold" role="status">{skewed.join(" ")} One resistance item goes a long way against it.</p>}
      <p className="mt-3 text-sm text-muted">{estimated
        ? "Estimated from champion classes where a champion has fewer than 20 collected games with damage data. Damage taken and CC appear once both teams are measured."
        : "Measured from collected games: average damage by type per minute, summed over the locked picks."}</p>
    </section>
  );
}

import { motion } from "framer-motion";
import { perfGrade, type PerfGrade } from "@apex/stats-core";
import type { PlayerRadar } from "@apex/schema";
import { useUi } from "../lib/store";
import { AXIS_LABEL, AXIS_UNIT, formatAxisValue, labelAnchor, radarPath, radarPoint, ringPath, scoreFrac } from "../lib/radarChart";

const W = 260, H = 224, CX = W / 2, CY = 108, R = 68, LABEL_R = R + 14;
/** Same S..D letters and colours as the post-game grade and the tier list. */
const GRADE_STYLE: Record<PerfGrade, string> = {
  S: "bg-accent/20 text-text border-accent/50", A: "bg-good/15 text-good border-good/30",
  B: "bg-raised text-text border-line/10", C: "bg-raised text-muted border-line/10", D: "bg-bad/15 text-bad border-bad/30",
};

/**
 * The skill radar of one role (R.3): needs `radar.axes` of at least 3 (the caller shows the empty state otherwise).
 * Score 50 (the dashed ring) is the collected rank average; the shape is drawn in once and not at all with "reduce motion".
 * Every number is also in the list below and in tooltips with screen-reader text; the SVG itself is one labelled image.
 */
export function SkillRadarChart({ radar }: { radar: PlayerRadar }) {
  const reduce = useUi((s) => s.reduceMotion);
  const axes = radar.axes, n = axes.length;
  const shape = radarPath(axes.map((a) => scoreFrac(a.score)), CX, CY, R);
  const overallLetter = radar.overall === null ? null : perfGrade(radar.overall);
  const summary = `Skill radar, ${radar.games} games: ${axes.map((a) => `${AXIS_LABEL[a.id]} ${Math.round(a.score)} of 100`).join(", ")}. 50 is the rank average.`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[20rem] mx-auto block" role="img" aria-label={summary}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <path key={f} d={ringPath(n, f, CX, CY, R)} fill="none" strokeWidth={1}
            className={f === 0.5 ? "stroke-gold/60" : "stroke-line/10"} strokeDasharray={f === 0.5 ? "4 3" : undefined} />))}
        {axes.map((a, i) => { const [x, y] = radarPoint(i, n, 1, CX, CY, R); return <line key={a.id} x1={CX} y1={CY} x2={x} y2={y} strokeWidth={1} className="stroke-line/10" />; })}
        <motion.path d={shape} strokeWidth={2} strokeLinejoin="round" className="stroke-accent fill-accent/20"
          initial={reduce ? false : { pathLength: 0, fillOpacity: 0 }} animate={{ pathLength: 1, fillOpacity: 1 }} transition={{ duration: reduce ? 0 : 0.9, ease: "easeOut" }} />
        {axes.map((a, i) => {
          const [px, py] = radarPoint(i, n, scoreFrac(a.score), CX, CY, R), [lx, ly] = radarPoint(i, n, 1, CX, CY, LABEL_R);
          return (<g key={a.id}>
            <circle cx={px} cy={py} r={3.5} className="fill-accent stroke-base" strokeWidth={1.5}>
              <title>{`${AXIS_LABEL[a.id]}: ${formatAxisValue(a.id, a.value)} ${AXIS_UNIT[a.id]} against ${formatAxisValue(a.id, a.reference)} on average (score ${Math.round(a.score)} of 100, grade ${a.letter})`}</title>
            </circle>
            <text x={lx} y={ly} textAnchor={labelAnchor(lx, CX)} dominantBaseline="middle" className="fill-muted text-[10px]" aria-hidden>{AXIS_LABEL[a.id]}</text>
          </g>);
        })}
      </svg>
      {radar.overall !== null && overallLetter && (
        <div className="flex items-center justify-center gap-2 mt-1" title="Mean of the axis scores. 50 = the rank average; it is a comparison with an average, not a verdict.">
          <span className="text-xs text-muted">Overall</span>
          <span className="font-display text-lg font-semibold tabular-nums">{Math.round(radar.overall)}</span>
          <span className={`rounded border px-1.5 text-xs font-semibold ${GRADE_STYLE[overallLetter]}`}>{overallLetter}</span>
        </div>)}
      <ul className="mt-3 space-y-1">
        {axes.map((a) => (
          <li key={a.id} className="flex items-center gap-3 min-h-8 text-sm" tabIndex={0} title={`${formatAxisValue(a.id, a.value)} ${AXIS_UNIT[a.id]}, rank average ${formatAxisValue(a.id, a.reference)}`}>
            <span className="flex-1 truncate">{AXIS_LABEL[a.id]}</span>
            <span className="tabular-nums">{formatAxisValue(a.id, a.value)}</span>
            <span className="text-xs text-muted tabular-nums w-14 text-right">avg {formatAxisValue(a.id, a.reference)}</span>
            <span className={`rounded border px-1.5 text-xs font-semibold ${GRADE_STYLE[a.letter]}`}>{a.letter}</span>
            <span className="sr-only">{`${AXIS_LABEL[a.id]}: ${formatAxisValue(a.id, a.value)} ${AXIS_UNIT[a.id]}, rank average ${formatAxisValue(a.id, a.reference)}, score ${Math.round(a.score)} of 100, grade ${a.letter}.`}</span>
          </li>))}
      </ul>
    </div>);
}

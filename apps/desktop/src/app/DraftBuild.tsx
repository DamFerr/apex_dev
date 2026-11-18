import { Fragment, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { Role } from "@apex/schema";
import { itemLayout, pageBuild, spellPairsOf } from "@apex/lcu-core";
import { GameIcon } from "../components/GameIcon";
import { LowBadge, pct, rate, wrClass } from "../components/StatRows";
import { Skeleton } from "../components/ui";
import { useChampionBuild } from "../lib/api";
import { MIN_BUILD_GAMES } from "../lib/importer";
import { displaySpells } from "../lib/spells";

/** Win rate (small-sample adjusted, same helper as the champion page) with its games and the "low data" badge. The 95% range is the tooltip. */
function Wr({ wins, games }: { wins: number; games: number }) {
  const s = rate(wins, games);
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted tabular-nums" title={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`}>
    <span className={`font-medium ${wrClass(s.adj)}`}>{pct(s.adj)}</span>{games.toLocaleString()}<LowBadge games={games} /></span>;
}
const Row = ({ label, children, right }: { label: string; children: ReactNode; right?: ReactNode }) =>
  <div className="flex items-center gap-2 min-h-8"><span className="w-14 shrink-0 text-[11px] uppercase tracking-wide text-muted">{label}</span><div className="flex items-center gap-1 flex-wrap min-w-0">{children}</div>{right && <span className="ml-auto pl-2 shrink-0">{right}</span>}</div>;

/**
 * Compact build for one suggested champion: top rune page, summoner spells, starting items and build order.
 * It reads the SAME build the champion page shows for this role and the current filters (`useChampionBuild` + `pageBuild`: the best variant),
 * and the same minimum of games the import uses, so what you see here is what "Import now" would write.
 */
export function BuildStrip({ id, role }: { id: string; role: Role }) {
  const { data: b, isLoading, isError } = useChampionBuild(id, role);
  if (isLoading) return <Skeleton className="h-24" />;
  if (isError) return <div className="text-xs text-muted">The build could not be loaded from the local backend.</div>;
  if (!b) return null;
  const { core, variant } = pageBuild(b);
  const rune = core.runePages[0], spell = spellPairsOf(core)[0], { start, order } = itemLayout(core);
  const runeOk = !!rune && rune.games >= MIN_BUILD_GAMES, spellOk = !!spell && spell.games >= MIN_BUILD_GAMES;
  if (!runeOk && !spellOk && !order && !start) return <div className="text-xs text-muted" title="Build data is stored for newly collected games only.">No build data for these filters yet.</div>;
  return (
    <div className="space-y-1.5 rounded-lg bg-raised/30 border border-line/5 px-3 py-2" aria-label="Suggested build">
      {runeOk && <Row label="Runes" right={<Wr wins={rune.wins} games={rune.games} />}>
        <GameIcon kind="rune" id={rune.perkIds[0]} size={30} round />
        {rune.perkIds.slice(1, 4).map((p) => <GameIcon key={p} kind="rune" id={p} size={22} round />)}
        <span className="w-1.5" aria-hidden /><GameIcon kind="rune" id={rune.subStyleId} size={20} round />
        {rune.perkIds.slice(4, 6).map((p) => <GameIcon key={p} kind="rune" id={p} size={22} round />)}</Row>}
      {spellOk && <Row label="Spells" right={<Wr wins={spell.wins} games={spell.games} />}>{displaySpells(spell.ids).map((s) => <GameIcon key={s} kind="spell" id={s} size={28} />)}</Row>}
      {start && <Row label="Start" right={<Wr wins={start.wins} games={start.games} />}>{start.items.map((it) => <GameIcon key={it.id} kind="item" id={it.id} name={it.name} size={28} count={it.count} />)}</Row>}
      {order && <Row label="Build" right={<Wr wins={order.wins} games={order.games} />}>
        {order.items.map((it, i) => <Fragment key={it.id}>{i > 0 && <ChevronRight size={12} className="text-muted/70 shrink-0" aria-hidden />}<GameIcon kind="item" id={it.id} name={it.name} size={28} /></Fragment>)}</Row>}
      <div className="text-[11px] text-muted" title="The same build as the champion page (best variant for this role and your filters). Win rates are adjusted for small samples. Skill order, starting items and build order come from games with a timeline.">
        {(variant ? variant.build : b).games.toLocaleString()} games{variant ? ` · ${variant.label}` : ""} · as {role}</div>
    </div>
  );
}

import { Fragment, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { RoleIcon } from "../components/RoleIcon";
import type { BuildItem, ChampionBuild, ItemPathStat, Role, RunePageStat } from "@apex/schema";
import { placeFlash, SHARD_ROWS, SPELL_NAMES } from "@apex/lcu-core";
import { Chip, Skeleton } from "../components/ui";
import { pct, rate, LowBadge, Wpa } from "../components/StatRows";
import { useChampionBuild } from "../lib/api";
import { useUi } from "../lib/store";
import { useRuneLookup, useRunes } from "../lib/ddragon";
import { GameIcon } from "../components/GameIcon";

const wr = (wins: number, games: number) => { const s = rate(wins, games); return <span className={`tabular-nums font-medium ${s.adj >= 0.5 ? "text-good" : "text-bad"}`} title={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`}>{pct(s.adj)}</span>; };
const spellText = (ids: [number, number], slot: "D" | "F") => placeFlash(ids, slot).map((i) => SPELL_NAMES[i] ?? i).join(" + ");
const Arrow = () => <ChevronRight size={14} className="text-muted/70 shrink-0" aria-hidden />;
const Heading = ({ children }: { children: ReactNode }) => <div className="text-sm font-medium">{children}</div>;
type Core = Omit<ChampionBuild, "variants">;
export type VariantSort = "best" | "rate" | "common";

/** One rune (or shard) among the others of its row: the chosen one is lit, the rest are dimmed, like in the game's rune editor. */
function Pick({ on, children }: { on: boolean; children: ReactNode }) {
  // inline-flex + shrink-0: the ring hugs the icon exactly (a plain span as a flex item got line-height space below the icon and the ring turned into a tall oval)
  return <span data-selected={on} className={`inline-flex shrink-0 rounded-full transition-[opacity,filter] ${on ? "ring-2 ring-gold/70 shadow-glow" : "opacity-30 grayscale"}`}>{children}</span>;
}

/** A rune tree with every rune of it, the chosen ones lit. Falls back to just the chosen runes when Data Dragon is unavailable. */
function RuneTree({ styleId, chosen, primary, label }: { styleId: number; chosen: number[]; primary: boolean; label: string }) {
  const styles = useRunes().data, names = useRuneLookup(), st = styles?.find((s) => s.id === styleId), on = new Set(chosen);
  const rows = st ? (primary ? st.slots : st.slots.slice(1)).map((sl) => sl.runes.map((r) => r.id)) : [chosen];
  return (<div role="group" aria-label={label} className="space-y-3.5">
    <div className="flex items-center justify-center gap-2 text-xs text-muted">
      {(styles ?? []).map((s) => <span key={s.id} className={s.id === styleId ? "" : "opacity-30 grayscale"}><GameIcon kind="rune" id={s.id} size={18} /></span>)}
      {!styles && <GameIcon kind="rune" id={styleId} size={18} />}<span className="text-text">{names.get(styleId)?.name}</span></div>
    {rows.map((ids, ri) => <div key={ri} className="flex items-center justify-center gap-3 h-11">{ids.map((id) => <Pick key={id} on={on.has(id)}><GameIcon kind="rune" id={id} size={primary && ri === 0 ? 44 : 36} /></Pick>)}</div>)}
  </div>);
}

function Shards({ ids }: { ids: number[] }) {
  return (<div role="group" aria-label="Stat shards" className="space-y-2.5">
    {[0, 1, 2].map((row) => { const opts = SHARD_ROWS[row].includes(ids[row]) ? SHARD_ROWS[row] : [...SHARD_ROWS[row], ids[row]];
      return <div key={row} className="flex items-center justify-center gap-3">{opts.map((id) => <Pick key={id} on={id === ids[row]}><GameIcon kind="shard" id={id} size={26} /></Pick>)}</div>; })}
  </div>);
}

function RunesColumn({ b }: { b: Core }) {
  const [pick, setPick] = useState(0), names = useRuneLookup();
  const page: RunePageStat | undefined = b.runePages[Math.min(pick, b.runePages.length - 1)];
  return (<div className="space-y-4 mx-auto w-full max-w-[560px]">
    <Heading>Runes</Heading>
    {b.runePages.length > 1 && <div className="flex flex-wrap justify-center gap-2">{b.runePages.map((p, i) =>
      <button key={i} onClick={() => setPick(i)} aria-pressed={i === pick} className={`focus-ring rounded-lg border px-2.5 py-1.5 flex items-center gap-2 text-xs transition-colors ${i === pick ? "border-accent/60 bg-accent/15" : "border-line/10 hover:bg-raised/60"}`} title={`${names.get(p.perkIds[0])?.name ?? "Page"}: ${p.games} games`}>
        <GameIcon kind="rune" id={p.perkIds[0]} size={26} /><span className="text-left leading-tight"><span className="block">{wr(p.wins, p.games)}</span><span className="block text-muted">{p.games.toLocaleString()} games</span></span></button>)}</div>}
    {page && <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg bg-raised/30 border border-line/5 p-4">
        <RuneTree styleId={page.primaryStyleId} chosen={page.perkIds.slice(0, 4)} primary label="Primary runes" />
        <div className="space-y-5">
          <RuneTree styleId={page.subStyleId} chosen={page.perkIds.slice(4, 6)} primary={false} label="Secondary runes" />
          <Shards ids={page.perkIds.slice(6)} />
        </div>
      </div>
      <div className="text-xs text-muted text-center" title="Each rune is the most common choice among these games">This page: {wr(page.wins, page.games)} in {page.games.toLocaleString()} games<LowBadge games={page.games} /></div>
    </>}
    {!page && (b.keystones.length > 0
      ? <div className="space-y-2">
          <div className="flex flex-wrap gap-4">{b.keystones.map((k) => <div key={k.id} className="flex items-center gap-2" title={`${names.get(k.id)?.name ?? "Keystone"}: ${k.games} games`}>
            <GameIcon kind="rune" id={k.id} size={40} /><div className="text-xs leading-tight"><div>{wr(k.wins, k.games)}</div><div className="text-muted">{k.games.toLocaleString()} games</div></div></div>)}</div>
          <div className="text-xs text-muted">Keystones only. Full rune pages (all runes and shards) are stored for newly collected games, so none of this champion's games has one yet. They appear as the collector gathers more.</div>
        </div>
      : <div className="text-xs text-muted">No rune data for these filters yet.</div>)}
  </div>);
}

function SpellsBlock({ b }: { b: Core }) {
  const flashSlot = useUi((s) => s.flashSlot), pairs = b.spellPairs?.length ? b.spellPairs : b.spells ? [b.spells] : [];
  if (!pairs.length) return null;
  return (<div className="space-y-2">
    <Heading>Summoner spells</Heading>
    {pairs.map((p) => <div key={p.ids.join()} role="group" aria-label={`Summoner spells ${spellText(p.ids, flashSlot)}`} className="flex items-center gap-3 rounded-lg bg-raised/40 border border-line/5 px-3 py-2">
      <span className="inline-flex items-center gap-1.5">{placeFlash(p.ids, flashSlot).map((sid) => <GameIcon key={sid} kind="spell" id={sid} size={30} />)}</span>
      <span className="text-sm">{wr(p.wins, p.games)}</span><span className="text-xs text-muted ml-auto">{p.games.toLocaleString()} games<LowBadge games={p.games} /></span></div>)}
  </div>);
}

/** An item with its win rate, WPA and games under it. */
function ItemCell({ it }: { it: BuildItem }) {
  return (<div className="flex flex-col items-center gap-1 w-14" title={`${it.name}: ${it.games} games`}>
    <GameIcon kind="item" id={it.id} name={it.name} size={40} />
    <span className="text-[11px] leading-none">{wr(it.wins, it.games)}</span>{it.wpa && <span className="text-[11px] leading-none"><Wpa w={it.wpa} /></span>}<span className="text-[10px] text-muted leading-none">{it.games}</span></div>);
}

function Starting({ p }: { p: ItemPathStat }) {
  return (<div><div className="text-xs text-muted mb-1">Starting items <span>· {wr(p.wins, p.games)} in {p.games.toLocaleString()} games<LowBadge games={p.games} /></span></div>
    <div className="flex items-center gap-2">{p.items.map((it) => <GameIcon key={it.id} kind="item" id={it.id} name={it.name} size={36} count={it.count} />)}</div></div>);
}

function ItemsColumn({ b }: { b: Core }) {
  const stats = new Map<number, BuildItem>(b.itemBlocks.flatMap((blk) => blk.items.map((i) => [i.id, i] as const)));
  const order = b.buildOrder ?? b.corePath, inOrder = new Set(order?.items.map((i) => i.id));
  // With a build order the Core block IS that order (shown as a row of arrows) and boots in it are not listed again.
  const blocks = b.itemBlocks.filter((blk) => !(order && blk.name === "Core items")).map((blk) => ({ ...blk, items: blk.items.filter((i) => !inOrder.has(i.id)) })).filter((blk) => blk.items.length > 0);
  const missing = [!b.skillOrder && "Skill order", !b.startItems && "Starting items"].filter(Boolean).join(" and ");
  return (<div className="space-y-3">
    <Heading>Items <span className="text-xs text-muted font-normal">(win rates are from final inventories)</span></Heading>
    {b.startItems && <Starting p={b.startItems} />}
    {missing && b.timelineGames > 0 && <div className="text-xs text-muted">{missing}: not enough games yet. {!b.skillOrder && !b.startItems ? "They need" : "It needs"} {b.minPathGames}+ timeline games with the same {!b.skillOrder && !b.startItems ? "choices" : !b.skillOrder ? "max order" : "starting set"} ({b.timelineGames.toLocaleString()} timeline {b.timelineGames === 1 ? "game" : "games"} so far).</div>}
    {order && <div>
      <div className="text-xs text-muted mb-1">Build order <span>· {wr(order.wins, order.games)} in {order.games.toLocaleString()} games that kept all the core items<LowBadge games={order.games} /></span></div>
      <div className="flex flex-wrap items-start gap-1" aria-label={`Build order ${order.items.map((i) => i.name).join(", then ")}`}>{order.items.map((it, i) => <Fragment key={it.id}>
        {i > 0 && <span className="self-start mt-3"><Arrow /></span>}{stats.get(it.id) ? <ItemCell it={stats.get(it.id)!} /> : <GameIcon kind="item" id={it.id} name={it.name} size={40} />}</Fragment>)}</div>
    </div>}
    {blocks.map((blk) => <div key={blk.name}>
      <div className="text-xs text-muted mb-1">{blk.name}</div>
      <div className="flex flex-wrap items-start gap-3">{blk.items.map((it) => <ItemCell key={it.id} it={it} />)}</div></div>)}
    {!order && b.timelineGames > 0 && b.itemBlocks.some((blk) => blk.name === "Core items") && <div className="text-xs text-muted">Core items are shown by popularity, not build order: the order needs {b.minPathGames}+ timeline games that kept the same three ({b.timelineGames.toLocaleString()} so far).</div>}
    {b.itemBlocks.some((blk) => blk.items.some((it) => it.wpa)) && <div className="text-[11px] text-muted" title="WPA = win probability added, in percentage points, vs games without the item of the same length and number of finished items. Green or red only when its 95% range excludes 0. A link, not proof.">Under each item: win rate, <span className="text-text">WPA</span>, games. A link, not proof.</div>}
  </div>);
}

/** Max order as icons plus the 18-level grid (one lit cell per level). */
function SkillBlock({ id, b }: { id: string; b: Core }) {
  const s = b.skillOrder; if (!s) return null;
  const grid = s.grid ?? s.levels, levels = Array.from({ length: grid.length }, (_, i) => i + 1);
  const cols = { gridTemplateColumns: `28px repeat(${grid.length}, 32px)` };
  return (<div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <Heading>Ability max order</Heading>
      <span className="text-xs text-muted">Skill order · {wr(s.wins, s.games)} in {s.games.toLocaleString()} games<LowBadge games={s.games} /></span>
      <div className="flex items-center gap-1" aria-label={`Max order ${s.max.join(" then ")}`}>{s.max.map((k, i) => <Fragment key={k}>{i > 0 && <Arrow />}<GameIcon kind="ability" champion={id} slot={k as "Q" | "W" | "E"} size={34} /></Fragment>)}</div>
    </div>
    <div role="table" aria-label="Skill order by level" className="space-y-1 text-[11px] w-max max-w-full overflow-x-auto">
      <div role="row" className="grid items-center gap-0.5 text-muted text-center" style={cols}><span aria-hidden />{levels.map((l) => <span key={l} role="columnheader">{l}</span>)}</div>
      {(["Q", "W", "E", "R"] as const).map((k) => <div key={k} role="row" className="grid items-center gap-0.5" style={cols}>
        <GameIcon kind="ability" champion={id} slot={k} size={22} keyBadge={false} />
        {grid.map((g, i) => <span key={i} role="cell" data-on={g === k} aria-label={g === k ? `Level ${i + 1}: ${k}` : undefined}
          className={`h-6 grid place-items-center rounded-sm font-semibold ${g === k ? (k === "R" ? "bg-gold/25 text-gold" : "bg-accent/30 text-text") : "bg-raised/40"}`}>{g === k ? k : ""}</span>)}</div>)}
    </div>
    <span className="sr-only">First 9 levels: {s.levels.join(" ")}</span>
    <div className="text-[11px] text-muted" title="Levels 1–9: the most common real sequence among games with this max order. Later levels follow the max order (R at 6, 11 and 16).">Levels 1–9 real · later levels follow the max order</div>
  </div>);
}

/** The list of build variants (AP, AD, Tank) with a sort switch, like the build list of a champion page on Lolalytics or Blitz. */
function VariantList({ b, sort, setSort, selected, setSelected }: { b: ChampionBuild; sort: VariantSort; setSort: (s: VariantSort) => void; selected: string; setSelected: (id: string) => void }) {
  const sorted = sortVariants(b, sort);
  return (<div className="space-y-3" role="group" aria-label="Build variants">
    <div className="flex gap-1.5 flex-wrap">{([["best", "Best"], ["rate", "Win rate"], ["common", "Common"]] as const).map(([k, l]) => <Chip key={k} active={sort === k} onClick={() => setSort(k)}>{l}</Chip>)}</div>
    <ul className="space-y-2">{sorted.map((v) => { const items = (v.build.buildOrder ?? v.build.corePath)?.items ?? v.build.itemBlocks.find((x) => x.name === "Core items")?.items ?? [], key = v.build.runePages[0]?.perkIds[0] ?? v.build.keystones[0]?.id;
      return <li key={v.id}><button onClick={() => setSelected(v.id)} aria-pressed={v.id === selected} aria-label={`${v.label} build, ${v.games} games`}
        className={`focus-ring w-full text-left rounded-lg border p-3 transition-colors ${v.id === selected ? "border-accent/60 bg-accent/15" : "border-line/10 hover:bg-raised/60"}`}>
        <div className="flex items-baseline justify-between"><span className="font-display font-semibold">{v.label}</span><span className="text-sm">{wr(v.wins, v.games)}</span></div>
        <div className="text-[11px] text-muted mb-2">{v.games.toLocaleString()} games<LowBadge games={v.games} /></div>
        <div className="flex items-center gap-1.5">{key && <GameIcon kind="rune" id={key} size={22} />}{items.slice(0, 4).map((it) => <GameIcon key={it.id} kind="item" id={it.id} name={it.name} size={24} />)}</div>
      </button></li>; })}</ul>
    <p className="text-[11px] text-muted" title="Grouped by finished items (Data Dragon tags): AP, AD or defensive. Games with fewer than three finished items are not grouped. “Best” ranks by the lower end of the 95% range, so a small sample cannot win.">Grouped by finished items. “Best” ranks by the 95% lower bound.</p>
  </div>);
}

/** Variants in the order of the chosen tab. Best = lower end of the Wilson range (small samples cannot win), Win rate = shrunk win rate, Common = games. */
export function sortVariants(b: ChampionBuild, sort: VariantSort) {
  const key = (v: { wins: number; games: number }) => { const s = rate(v.wins, v.games); return sort === "best" ? s.lo : sort === "rate" ? s.adj : v.games; };
  return [...(b.variants ?? [])].sort((x, y) => key(y) - key(x) || y.games - x.games);
}

/** Recommended runes, summoner spells, items and skill order from collected games, as separate builds when players really build differently (AP, AD, Tank). */
export function BuildPanel({ id, roles }: { id: string; roles: Role[] }) {
  const [role, setRole] = useState<Role | undefined>(roles[0]), [sort, setSort] = useState<VariantSort>("best"), [vid, setVid] = useState("");
  const { data: b, isError, isLoading } = useChampionBuild(id, role);
  const variants = b?.variants ?? [], sorted = b ? sortVariants(b, sort) : [], active = sorted.find((v) => v.id === vid) ?? sorted[0];
  const cur: Core | undefined = active ? active.build : b;
  const has = !!cur && (cur.runePages.length > 0 || cur.keystones.length > 0 || cur.itemBlocks.length > 0 || !!cur.skillOrder);

  return (<div className="glass rounded-lg p-5 space-y-5" aria-label="Recommended build">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-display text-lg font-semibold mr-auto">Recommended build</h2>
      {roles.length > 1 && roles.map((r) => <Chip key={r} active={role === r} onClick={() => { setRole(r); setVid(""); }}><span className="inline-flex items-center gap-1.5"><RoleIcon role={r} size={16} decorative />{r}</span></Chip>)}
    </div>
    {isLoading && <Skeleton className="h-32" />}
    {isError && <div className="text-sm text-muted">The build could not be loaded from the local backend.</div>}
    {b && !has && <div className="text-sm text-muted">No rune or item data for these filters yet. Rune pages are stored for newly collected games only; games collected by older versions of Apex do not have them.</div>}
    {b && cur && has && <div className={`grid gap-x-8 gap-y-6 items-start ${variants.length ? "grid-cols-[210px_minmax(0,1fr)_300px]" : "grid-cols-[minmax(0,1fr)_300px]"}`}>
      {variants.length > 0 && b && <VariantList b={b} sort={sort} setSort={setSort} selected={active?.id ?? ""} setSelected={setVid} />}
      <div key={`r-${active?.id ?? "all"}`}><RunesColumn b={cur} /></div>
      <div className="space-y-5"><SpellsBlock b={cur} /><ItemsColumn b={cur} /></div>
      {cur.skillOrder && <div className={variants.length ? "col-span-2 col-start-2" : "col-span-2"}><SkillBlock id={id} b={cur} /></div>}
    </div>}
    <div className="text-xs text-muted">From {(cur ?? b)?.games.toLocaleString() ?? "…"} collected games{active ? ` with ${active.label} builds` : ""}{role ? ` as ${role}` : ""} with your current filters; skill order, starting items and build order come from the {(cur ?? b)?.timelineGames.toLocaleString() ?? "…"} of them that have a match timeline (a sample). Win rates are adjusted for small samples. In champ select, Apex can import this to the League client (Draft screen).</div>
  </div>);
}

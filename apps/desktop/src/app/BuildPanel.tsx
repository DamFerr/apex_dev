import { Fragment, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { RoleIcon } from "../components/RoleIcon";
import type { BuildItem, ChampionBuild, ItemPathStat, Role, RunePageStat } from "@apex/schema";
import { itemLayout, placeFlash, SHARD_ROWS, sortVariants, SPELL_NAMES, type PageCore, type VariantSort } from "@apex/lcu-core";
import { Chip, Skeleton } from "../components/ui";
import { pct, rate, LowBadge, Wpa, wrClass } from "../components/StatRows";
import { useChampionBuild } from "../lib/api";
import { useUi } from "../lib/store";
import { useRuneLookup, useRunes } from "../lib/ddragon";
import { GameIcon } from "../components/GameIcon";

const wr = (wins: number, games: number) => { const s = rate(wins, games); return <span className={`tabular-nums font-medium ${wrClass(s.adj)}`} title={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`}>{pct(s.adj)}</span>; };
const spellText = (ids: [number, number], slot: "D" | "F") => placeFlash(ids, slot).map((i) => SPELL_NAMES[i] ?? i).join(" + ");
const Arrow = () => <ChevronRight size={14} className="text-muted/70 shrink-0" aria-hidden />;
const Heading = ({ children }: { children: ReactNode }) => <div className="text-[1rem] leading-6 font-semibold font-display">{children}</div>;
type Core = PageCore;

/** One rune (or shard) among the others of its row: the chosen one is lit, the rest are dimmed, like in the game's rune editor. */
function Pick({ on, children }: { on: boolean; children: ReactNode }) {
  // inline-flex + shrink-0: the ring hugs the icon exactly (a plain span as a flex item got line-height space below the icon and the ring turned into a tall oval)
  return <span data-selected={on} className={`inline-flex shrink-0 rounded-full transition-[opacity,filter] ${on ? "ring-2 ring-gold/70 shadow-glow" : "opacity-30 grayscale"}`}>{children}</span>;
}

/** A rune tree with every rune of it, the chosen ones lit. Falls back to just the chosen runes when Data Dragon is unavailable. */
function RuneTree({ styleId, chosen, primary, label }: { styleId: number; chosen: number[]; primary: boolean; label: string }) {
  const styles = useRunes().data, names = useRuneLookup(), st = styles?.find((s) => s.id === styleId), on = new Set(chosen);
  const rows = st ? (primary ? st.slots : st.slots.slice(1)).map((sl) => sl.runes.map((r) => r.id)) : [chosen];
  return (<div role="group" aria-label={label} className="space-y-4">
    <div className="flex items-center justify-center gap-2 text-xs text-muted">
      {(styles ?? []).map((s) => <span key={s.id} className={s.id === styleId ? "" : "opacity-30 grayscale"}><GameIcon kind="rune" id={s.id} size={22} /></span>)}
      {!styles && <GameIcon kind="rune" id={styleId} size={22} />}<span className="text-text text-sm font-medium">{names.get(styleId)?.name}</span></div>
    {rows.map((ids, ri) => <div key={ri} className="flex items-center justify-center gap-4 h-14">{ids.map((id) => <Pick key={id} on={on.has(id)}><GameIcon kind="rune" id={id} size={primary && ri === 0 ? 54 : 42} /></Pick>)}</div>)}
  </div>);
}

function Shards({ ids }: { ids: number[] }) {
  return (<div role="group" aria-label="Stat shards" className="space-y-3">
    {[0, 1, 2].map((row) => { const opts = SHARD_ROWS[row].includes(ids[row]) ? SHARD_ROWS[row] : [...SHARD_ROWS[row], ids[row]];
      return <div key={row} className="flex items-center justify-center gap-4">{opts.map((id) => <Pick key={id} on={id === ids[row]}><GameIcon kind="shard" id={id} size={32} /></Pick>)}</div>; })}
  </div>);
}

function RunesColumn({ b }: { b: Core }) {
  const [pick, setPick] = useState(0), names = useRuneLookup();
  const page: RunePageStat | undefined = b.runePages[Math.min(pick, b.runePages.length - 1)];
  return (<div className="space-y-5 mx-auto w-full max-w-[640px]">
    <Heading>Runes</Heading>
    {b.runePages.length > 1 && <div className="flex flex-wrap justify-center gap-2">{b.runePages.map((p, i) =>
      <button key={i} onClick={() => setPick(i)} aria-pressed={i === pick} className={`focus-ring rounded-lg border px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${i === pick ? "border-accent/60 bg-accent/15" : "border-line/10 hover:bg-raised/60"}`} title={`${names.get(p.perkIds[0])?.name ?? "Page"}: ${p.games} games`}>
        <GameIcon kind="rune" id={p.perkIds[0]} size={32} /><span className="text-left leading-tight"><span className="block">{wr(p.wins, p.games)}</span><span className="block text-muted">{p.games.toLocaleString()} games</span></span></button>)}</div>}
    {page && <>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 rounded-lg bg-raised/30 border border-line/5 p-6">
        <RuneTree styleId={page.primaryStyleId} chosen={page.perkIds.slice(0, 4)} primary label="Primary runes" />
        <div className="space-y-6">
          <RuneTree styleId={page.subStyleId} chosen={page.perkIds.slice(4, 6)} primary={false} label="Secondary runes" />
          <Shards ids={page.perkIds.slice(6)} />
        </div>
      </div>
    </>}
    {!page && (b.keystones.length > 0
      ? <div className="space-y-2">
          <div className="flex flex-wrap gap-4">{b.keystones.map((k) => <div key={k.id} className="flex items-center gap-2" title={`${names.get(k.id)?.name ?? "Keystone"}: ${k.games} games`}>
            <GameIcon kind="rune" id={k.id} size={40} /><div className="text-xs leading-tight"><div>{wr(k.wins, k.games)}</div><div className="text-muted">{k.games.toLocaleString()} games</div></div></div>)}</div>
          <div className="text-xs text-muted" title={KEYSTONE_TIP}>Keystones only<span className="sr-only">. {KEYSTONE_TIP}</span></div>
        </div>
      : <div className="text-xs text-muted">No rune data for these filters yet.</div>)}
  </div>);
}

/** Why only keystones show: detail for the tooltip and screen readers. */
const KEYSTONE_TIP = "Full rune pages (all runes and shards) are stored for newly collected games only. They appear as the collector gathers more.";

function SpellsBlock({ b }: { b: Core }) {
  const flashSlot = useUi((s) => s.flashSlot), pairs = b.spellPairs?.length ? b.spellPairs : b.spells ? [b.spells] : [];
  if (!pairs.length) return null;
  return (<div className="space-y-3 shrink-0 w-[380px] max-w-full">
    <Heading>Summoner spells</Heading>
    {pairs.map((p) => <div key={p.ids.join()} role="group" aria-label={`Summoner spells ${spellText(p.ids, flashSlot)}`} className="flex items-center gap-4 rounded-lg bg-raised/40 border border-line/5 px-4 py-3">
      <span className="inline-flex items-center gap-2">{placeFlash(p.ids, flashSlot).map((sid) => <GameIcon key={sid} kind="spell" id={sid} size={40} />)}</span>
      <span className="text-[1rem] leading-6">{wr(p.wins, p.games)}</span><span className="text-sm text-muted ml-auto">{p.games.toLocaleString()} games<LowBadge games={p.games} /></span></div>)}
  </div>);
}

/** A section header: short label on the left, the win rate big and coloured on the right with its games ("low data" badge when small). The long explanation is the tooltip. */
function Stat({ label, wins, games, hint, heading = false }: { label: string; wins: number; games: number; hint?: string; heading?: boolean }) {
  return (<div className="flex items-baseline justify-between gap-3">
    <span className={heading ? "text-[1rem] leading-6 font-semibold font-display" : "text-sm text-muted"} title={hint}>{label}</span>
    <span className="inline-flex items-baseline gap-2"><span className="text-xl font-semibold font-display leading-none">{wr(wins, games)}</span><span className="text-xs text-muted">{games.toLocaleString()} games</span><LowBadge games={games} /></span></div>);
}

/** An item with its win rate, WPA and games under it. */
function ItemCell({ it }: { it: BuildItem }) {
  return (<div className="flex flex-col items-center gap-1.5 w-[68px]" title={`${it.name}: ${it.games} games`}>
    <GameIcon kind="item" id={it.id} name={it.name} size={50} />
    <span className="text-xs leading-none">{wr(it.wins, it.games)}</span>{it.wpa && <span className="text-xs leading-none"><Wpa w={it.wpa} /></span>}<span className="text-[11px] text-muted leading-none">{it.games}</span></div>);
}

function Starting({ p }: { p: ItemPathStat }) {
  return (<div className="space-y-2"><Stat label="Starting items" wins={p.wins} games={p.games} hint="The most common starting set, from games with a match timeline" />
    <div className="flex items-center gap-2">{p.items.map((it) => <GameIcon key={it.id} kind="item" id={it.id} name={it.name} size={46} count={it.count} />)}</div></div>);
}

function ItemsColumn({ b }: { b: Core }) {
  const stats = new Map<number, BuildItem>(b.itemBlocks.flatMap((blk) => blk.items.map((i) => [i.id, i] as const)));
  // The same layout the draft import writes to the client (`itemLayout` in lcu-core): every item once, boots in the order or under "Boots options".
  const { order, groups: blocks } = itemLayout(b);
  const missing = [!b.skillOrder && "Skill order", !b.startItems && "Starting items"].filter(Boolean).join(" and ");
  return (<div className="space-y-5">
    <Heading><span title="Win rates are from final inventories (what players owned at the end), not from the order they bought things.">Items</span></Heading>
    {b.startItems && <Starting p={b.startItems} />}
    {missing && b.timelineGames > 0 && <div className="text-xs text-muted" title={`Needs ${b.minPathGames}+ timeline games with the same ${!b.skillOrder && !b.startItems ? "choices" : !b.skillOrder ? "max order" : "starting set"}.`}>{missing}: need {b.minPathGames}+ timeline games ({b.timelineGames.toLocaleString()} so far)</div>}
    {order && <div>
      <div className="mb-2"><Stat label="Build order" wins={order.wins} games={order.games} hint={`${order.games.toLocaleString()} games that kept all the core items (the usual order, with the boots and, for supports, the support item where they are bought)`} /></div>
      <div className="flex flex-wrap items-start gap-x-1 gap-y-3" aria-label={`Build order ${order.items.map((i) => i.name).join(", then ")}`}>{order.items.map((it, i) => <Fragment key={it.id}>
        {i > 0 && <span className="self-start mt-4"><Arrow /></span>}{stats.get(it.id) ? <ItemCell it={stats.get(it.id)!} /> : <GameIcon kind="item" id={it.id} name={it.name} size={50} />}</Fragment>)}</div>
    </div>}
    {blocks.map((blk) => <div key={blk.key}>
      <div className="text-sm text-muted mb-1.5">{blk.label}</div>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-4">{blk.items.map((it) => <ItemCell key={it.id} it={it} />)}</div></div>)}
    {!order && b.timelineGames > 0 && b.itemBlocks.some((blk) => blk.name === "Core items") && <div className="text-xs text-muted" title="Core items are shown by popularity, not build order. The order needs timeline games that kept the same three items.">Core items by popularity · order needs {b.minPathGames}+ timeline games ({b.timelineGames.toLocaleString()} so far)</div>}
    {b.itemBlocks.some((blk) => blk.items.some((it) => it.wpa)) && <div className="text-[11px] text-muted" title="WPA = win probability added, in percentage points, vs games without the item of the same length and number of finished items. Green or red only when its 95% range excludes 0. A link, not proof.">Under each item: win rate, <span className="text-text">WPA</span>, games. A link, not proof.</div>}
  </div>);
}

/** Max order as icons plus the 18-level grid (one lit cell per level). */
function SkillBlock({ id, b }: { id: string; b: Core }) {
  const s = b.skillOrder; if (!s) return null;
  const grid = s.grid ?? s.levels, levels = Array.from({ length: grid.length }, (_, i) => i + 1);
  const cols = { gridTemplateColumns: `30px repeat(${grid.length}, minmax(0, 1fr))` };   // fluid: cells grow and shrink with the width, never scroll
  return (<div className="space-y-3 w-full">
    <Stat label="Skill order" wins={s.wins} games={s.games} heading hint="Most common max order among games with a match timeline" />
    <div className="flex items-center gap-3"><span className="text-sm text-muted">Max order</span>
      <div className="flex items-center gap-1" aria-label={`Max order ${s.max.join(" then ")}`}>{s.max.map((k, i) => <Fragment key={k}>{i > 0 && <Arrow />}<GameIcon kind="ability" champion={id} slot={k as "Q" | "W" | "E"} size={34} /></Fragment>)}</div>
    </div>
    <div role="table" aria-label="Skill order by level" className="space-y-1 text-xs w-full">
      <div role="row" className="grid items-center gap-0.5 text-muted text-center" style={cols}><span aria-hidden />{levels.map((l) => <span key={l} role="columnheader">{l}</span>)}</div>
      {(["Q", "W", "E", "R"] as const).map((k) => <div key={k} role="row" className="grid items-center gap-0.5" style={cols}>
        <GameIcon kind="ability" champion={id} slot={k} size={24} keyBadge={false} />
        {grid.map((g, i) => <span key={i} role="cell" data-on={g === k} aria-label={g === k ? `Level ${i + 1}: ${k}` : undefined}
          className={`h-7 grid place-items-center rounded-sm font-semibold ${g === k ? (k === "R" ? "bg-gold/25 text-gold" : "bg-accent/30 text-text") : "bg-raised/40"}`}>{g === k ? k : ""}</span>)}</div>)}
    </div>
    <span className="sr-only">First 9 levels: {s.levels.join(" ")}</span>
    <div className="text-[11px] text-muted" title="Levels 1–9: the most common real sequence among games with this max order. Later levels follow the max order (R at 6, 11 and 16).">Levels 1–9 real · later levels follow the max order</div>
  </div>);
}

/** Keystone and the first items of a build, as small icons. */
function BuildIcons({ build }: { build: Core }) {
  // Without a build order the summary still starts with the support item (supports always build it), then the most built core items.
  const items = (build.buildOrder ?? build.corePath)?.items ?? [...(build.itemBlocks.find((x) => x.name === "Support item")?.items.slice(0, 1) ?? []), ...(build.itemBlocks.find((x) => x.name === "Core items")?.items ?? [])], key = build.runePages[0]?.perkIds[0] ?? build.keystones[0]?.id;
  return <div className="flex flex-wrap items-center gap-1.5">{key && <GameIcon kind="rune" id={key} size={28} />}{items.slice(0, 4).map((it) => <GameIcon key={it.id} kind="item" id={it.id} name={it.name} size={30} />)}</div>;
}

/** The left column when there are no separate variants (few games, or everyone builds the same): the one build shown on the right, as a single selected row. */
function SingleBuild({ b }: { b: Core }) {
  return (<div className="space-y-3" role="group" aria-label="Build variants">
    <div aria-label={`Most played build, ${b.games} games`} className="rounded-lg border border-accent/60 bg-accent/15 p-3">
      <div className="flex items-baseline justify-between"><span className="font-display font-semibold">Most played</span>{b.wins !== undefined && <span className="text-sm">{wr(b.wins, b.games)}</span>}</div>
      <div className="text-[11px] text-muted mb-2">{b.games.toLocaleString()} games<LowBadge games={b.games} /></div>
      <BuildIcons build={b} />
    </div>
    <p className="text-[11px] text-muted" title="Separate AP / AD / Tank builds appear when at least two of them have 10+ games and 5% of the classified games.">One build so far</p>
  </div>);
}

/** The list of build variants (AP, AD, Tank) with a sort switch, like the build list of a champion page on Lolalytics or Blitz. */
function VariantList({ b, sort, setSort, selected, setSelected }: { b: ChampionBuild; sort: VariantSort; setSort: (s: VariantSort) => void; selected: string; setSelected: (id: string) => void }) {
  const sorted = sortVariants(b, sort);
  return (<div className="space-y-3" role="group" aria-label="Build variants">
    <div className="flex gap-1.5 flex-wrap">{([["best", "Best"], ["rate", "Win rate"], ["common", "Common"]] as const).map(([k, l]) => <Chip key={k} active={sort === k} onClick={() => setSort(k)}>{l}</Chip>)}</div>
    <ul className="space-y-2">{sorted.map((v) => (
      <li key={v.id}><button onClick={() => setSelected(v.id)} aria-pressed={v.id === selected} aria-label={`${v.label} build, ${v.games} games`}
        className={`focus-ring w-full text-left rounded-lg border p-3.5 transition-colors ${v.id === selected ? "border-accent/60 bg-accent/15" : "border-line/10 hover:bg-raised/60"}`}>
        <div className="flex items-baseline justify-between"><span className="font-display font-semibold">{v.label}</span><span className="text-sm">{wr(v.wins, v.games)}</span></div>
        <div className="text-[11px] text-muted mb-2">{v.games.toLocaleString()} games<LowBadge games={v.games} /></div>
        <BuildIcons build={v.build} />
      </button></li>))}</ul>
    <p className="text-[11px] text-muted" title="Grouped by finished items (Data Dragon tags): AP, AD or defensive. Games with fewer than three finished items are not grouped. “Best” ranks by the lower end of the 95% range, so a small sample cannot win.">Grouped by finished items</p>
  </div>);
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
    {b && !has && <div className="text-sm text-muted" title="Rune pages are stored for newly collected games only; games collected by older versions of Apex do not have them.">No build data for these filters yet.</div>}
    {b && cur && has && <div className="grid gap-x-10 gap-y-8 items-start grid-cols-[230px_minmax(0,1fr)] min-[1400px]:grid-cols-[230px_minmax(0,1fr)_minmax(0,1fr)]">
      {/* Wide window (1400px+), a 3-column grid in two rows:
          row 1: build variants | runes | items;  row 2: summoner spells | skill order, together as wide as the three columns.
          Narrower: variants on the left, everything else stacked in the right column (spells beside the skill order when they fit). */}
      <div className="min-w-0 min-[1400px]:col-start-1 min-[1400px]:row-start-1">
        {variants.length > 0 ? <VariantList b={b} sort={sort} setSort={setSort} selected={active?.id ?? ""} setSelected={setVid} /> : <SingleBuild b={b} />}
      </div>
      <div key={`r-${active?.id ?? "all"}`} className="min-w-0 col-start-2 min-[1400px]:row-start-1"><RunesColumn b={cur} /></div>
      {/* Bottom row: spells (fixed width) | skill order (takes the rest), covering all three columns on wide screens. */}
      <div className="col-start-2 flex flex-wrap items-start gap-x-10 gap-y-8 min-[1400px]:col-start-1 min-[1400px]:col-span-3 min-[1400px]:row-start-2 min-[1400px]:flex-nowrap">
        <SpellsBlock b={cur} />
        {cur.skillOrder && <div className="flex-1 min-w-[420px] min-[1400px]:min-w-0"><SkillBlock id={id} b={cur} /></div>}
      </div>
      <div className="min-w-0 col-start-2 min-[1400px]:col-start-3 min-[1400px]:row-start-1"><ItemsColumn b={cur} /></div>
    </div>}
    <div className="text-xs text-muted" title="Skill order, starting items and build order come only from the games that have a match timeline (a sample). Win rates are adjusted for small samples. In champ select, Apex can import this build to the League client (Draft screen).">{(cur ?? b)?.games.toLocaleString() ?? "…"} collected games{active ? ` with ${active.label} builds` : ""}{role ? ` as ${role}` : ""} · {(cur ?? b)?.timelineGames.toLocaleString() ?? "…"} with a timeline</div>
  </div>);
}

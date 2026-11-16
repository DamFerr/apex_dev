import { useState } from "react";
import type { ItemPathStat, Role, RunePageStat } from "@apex/schema";
import { placeFlash, SHARD_NAMES, SPELL_NAMES } from "@apex/lcu-core";
import { Chip, Skeleton } from "../components/ui";
import { pct, rate, LowBadge } from "../components/StatRows";
import { useChampionBuild } from "../lib/api";
import { useUi } from "../lib/store";
import { itemIconUrl, runeIconUrl, useDdVersion, useRunes } from "../lib/ddragon";

const wr = (wins: number, games: number) => { const s = rate(wins, games); return <span className={`tabular-nums font-medium ${s.adj >= 0.5 ? "text-good" : "text-bad"}`} title={`Raw ${pct(s.raw)} · 95% ${pct(s.lo, 0)}–${pct(s.hi, 0)}`}>{pct(s.adj)}</span>; };

const spellText = (ids: [number, number], slot: "D" | "F") => placeFlash(ids, slot).map((i) => SPELL_NAMES[i] ?? i).join(" + ");

/** Recommended runes, summoner spells and items from collected games. Everything shows its sample size; items are final inventories, not a build order. */
export function BuildPanel({ id, roles }: { id: string; roles: Role[] }) {
  const [role, setRole] = useState<Role | undefined>(roles[0]), [pick, setPick] = useState(0);
  const flashSlot = useUi((s) => s.flashSlot);
  const { data: b, isError, isLoading } = useChampionBuild(id, role), { data: styles } = useRunes(), { data: version } = useDdVersion();
  const names = new Map<number, { name: string; icon?: string }>();
  for (const st of styles ?? []) { names.set(st.id, { name: st.name, icon: st.icon }); for (const sl of st.slots) for (const r of sl.runes) names.set(r.id, { name: r.name, icon: r.icon }); }
  const page: RunePageStat | undefined = b?.runePages[Math.min(pick, (b?.runePages.length ?? 1) - 1)];
  const Rune = ({ rid, big }: { rid: number; big?: boolean }) => { const r = names.get(rid), size = big ? 44 : 32;
    return r?.icon ? <img src={runeIconUrl(r.icon)} alt={r.name} title={r.name} width={size} height={size} loading="lazy" className="rounded-full bg-base/60" /> : <span className="text-xs text-muted" title={String(rid)}>{r?.name ?? `Rune ${rid}`}</span>; };

  const Path = ({ label, p, arrows }: { label: string; p: ItemPathStat; arrows?: boolean }) => (<div>
    <div className="text-xs text-muted mb-1">{label} <span className="text-muted">· {wr(p.wins, p.games)} in {p.games.toLocaleString()} games<LowBadge games={p.games} /></span></div>
    <div className="flex items-center gap-2">{p.items.map((it, i) => <span key={it.id} className="flex items-center gap-2">{arrows && i > 0 && <span className="text-muted" aria-hidden>›</span>}
      <span className="relative" title={it.name}>{version ? <img src={itemIconUrl(version, it.id)} alt={it.name} width={36} height={36} loading="lazy" className="rounded-md bg-base/60" /> : <span className="block size-9 rounded-md bg-base/60" />}
        {it.count > 1 && <span className="absolute -right-1 -bottom-1 rounded bg-base text-[10px] px-1 border border-line/20">×{it.count}</span>}</span></span>)}</div></div>);

  return (<div className="glass rounded-lg p-5 space-y-5" aria-label="Recommended build">
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-display text-lg font-semibold mr-auto">Recommended build</h2>
      {roles.length > 1 && roles.map((r) => <Chip key={r} active={role === r} onClick={() => { setRole(r); setPick(0); }}>{r}</Chip>)}
    </div>
    {isLoading && <Skeleton className="h-32" />}
    {isError && <div className="text-sm text-muted">The build could not be loaded from the local backend.</div>}
    {b && !page && !b.itemBlocks.length && !b.skillOrder && <div className="text-sm text-muted">No rune or item data for these filters yet. Rune pages are stored for newly collected games only; games collected by older versions of Apex do not have them.</div>}
    {b && (page || b.itemBlocks.length > 0 || b.skillOrder) && <div className="grid grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="text-sm font-medium">Runes</div>
        {b.runePages.length > 1 && <div className="flex flex-wrap gap-2">{b.runePages.map((p, i) => <Chip key={i} active={i === pick} onClick={() => setPick(i)}>{names.get(p.perkIds[0])?.name ?? "Page"} · {p.games}</Chip>)}</div>}
        {page && <>
          <div className="flex items-center gap-3"><Rune rid={page.perkIds[0]} big /><div className="flex gap-2">{page.perkIds.slice(1, 4).map((r) => <Rune key={r} rid={r} />)}</div><span className="text-xs text-muted">{names.get(page.primaryStyleId)?.name}</span></div>
          <div className="flex items-center gap-3"><div className="flex gap-2">{page.perkIds.slice(4, 6).map((r) => <Rune key={r} rid={r} />)}</div><span className="text-xs text-muted">{names.get(page.subStyleId)?.name}</span></div>
          <div className="text-xs text-muted">{page.perkIds.slice(6).map((s) => SHARD_NAMES[s] ?? `Shard ${s}`).join(" · ")}</div>
          <div className="text-xs text-muted">This setup: {wr(page.wins, page.games)} win rate in {page.games.toLocaleString()} games<LowBadge games={page.games} />. Each rune is the most common choice among those games.</div>
        </>}
        {b.skillOrder && <div className="pt-1"><div className="text-xs text-muted mb-1">Skill order · {wr(b.skillOrder.wins, b.skillOrder.games)} in {b.skillOrder.games.toLocaleString()} games<LowBadge games={b.skillOrder.games} /></div>
          <div className="flex items-center gap-2" aria-label={`Max order ${b.skillOrder.max.join(" then ")}`}>{b.skillOrder.max.map((k, i) => <span key={k} className="flex items-center gap-2">{i > 0 && <span className="text-muted" aria-hidden>›</span>}
            <span className="size-8 grid place-items-center rounded-md bg-accent/20 border border-accent/40 font-display font-semibold">{k}</span></span>)}</div>
          <div className="text-xs text-muted mt-2 tabular-nums" title="First 9 skill points, most common sequence among games with this max order">First 9 levels: {b.skillOrder.levels.join(" ")}</div></div>}
        {b.spells && <div className="text-sm pt-1">Summoner spells: <span className="font-medium">{spellText(b.spells.ids, flashSlot)}</span>{" "}
          <span className="text-xs text-muted">({wr(b.spells.wins, b.spells.games)} in {b.spells.games.toLocaleString()} games)</span></div>}
      </div>
      <div className="space-y-3">
        <div className="text-sm font-medium">Items <span className="text-xs text-muted font-normal">(blocks below are final inventories, not a build order)</span></div>
        {b.startItems && <Path label="Starting items" p={b.startItems} />}
        {b.corePath && <Path label="First three finished items, in order" p={b.corePath} arrows />}
        {b.itemBlocks.map((blk) => <div key={blk.name}>
          <div className="text-xs text-muted mb-1">{blk.name}</div>
          <div className="flex flex-wrap gap-3">{blk.items.map((it) => <div key={it.id} className="flex flex-col items-center gap-1 w-14" title={`${it.name}: ${it.games} games`}>
            {version ? <img src={itemIconUrl(version, it.id)} alt={it.name} width={40} height={40} loading="lazy" className="rounded-md bg-base/60" /> : <div className="size-10 rounded-md bg-base/60" />}
            <span className="text-[11px] leading-none">{wr(it.wins, it.games)}</span><span className="text-[10px] text-muted leading-none">{it.games}</span></div>)}</div>
        </div>)}
      </div>
    </div>}
    <div className="text-xs text-muted">From {b?.games.toLocaleString() ?? "…"} collected games{role ? ` as ${role}` : ""} with your current filters; skill order, starting items and build order come from the {b?.timelineGames.toLocaleString() ?? "…"} of them that have a match timeline (a sample). Win rates are adjusted for small samples. In champ select, Apex can import this to the League client (Draft screen).</div>
  </div>);
}

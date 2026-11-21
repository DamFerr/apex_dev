import type { ReactNode } from "react";
import { timeAgo } from "@apex/stats-core";
import type { MatchFilter, MatchSummary, QueueFilter, Role } from "@apex/schema";
import { QUEUE_FILTERS } from "@apex/schema";
import { ChampIconLink } from "./ChampLink";
import { LoadoutIcons } from "./LoadoutIcons";
import { ROLE_LABEL, RoleIcon } from "./RoleIcon";
import { Chip } from "./ui";
import { useChampName } from "../lib/ddragon";

/**
 * One finished game as a dense row, the same on Profile and Home: champion icon with its level, name, result and how long ago, K/D/A with CS,
 * role, loadout icons (spells, keystone, items), queue and length. The coloured strip on the left is the result (and the word Win/Loss is kept
 * next to it, so colour is never the only signal). `trailing` is the expand arrow on Profile.
 */
export function MatchRowIcon({ m }: { m: MatchSummary }) {
  const name = useChampName()(m.champion);
  return (<span className="relative shrink-0" title={`${name}${m.level ? `, level ${m.level}` : ""}`}>
    <ChampIconLink id={m.champion} name={name} size={40} alone />
    {m.level ? <span aria-hidden className="pointer-events-none absolute -right-1 -bottom-1 rounded bg-base border border-line/30 text-[10px] leading-4 px-1 tabular-nums">{m.level}</span> : null}
  </span>);
}

/** The row without its champion icon (that sits outside the expand button, because a link cannot live inside a button). */
export function MatchRowBody({ m, trailing }: { m: MatchSummary; trailing?: ReactNode }) {
  const champName = useChampName(), name = champName(m.champion), kda = m.deaths === 0 ? "Perfect" : ((m.kills + m.assists) / m.deaths).toFixed(2);
  return (<div className="flex items-center gap-4 w-full">
    <span className="w-32 min-w-0 leading-tight">
      <span className="block font-medium truncate">{name}</span>
      <span className="block text-xs text-muted"><span className={`font-medium ${m.win ? "text-good" : "text-bad"}`}>{m.win ? "Win" : "Loss"}</span> · <time dateTime={m.playedAt} title={new Date(m.playedAt).toLocaleString()}>{timeAgo(m.playedAt)}</time></span>
    </span>
    <span className="w-24 leading-tight tabular-nums" title={`${kda} KDA`}>
      <span className="block text-sm">{m.kills}/{m.deaths}/{m.assists}</span>
      <span className="block text-xs text-muted">{m.cs} CS</span>
    </span>
    <span className="w-5 text-muted shrink-0"><RoleIcon role={m.role} size={20} /></span>
    {m.loadout && <LoadoutIcons loadout={m.loadout} size={24} />}
    <span className="ml-auto text-right text-xs text-muted leading-tight shrink-0">
      <span className="block">{m.queue}</span><span className="block tabular-nums">{Math.round(m.durationSec / 60)} min</span>
    </span>
    {trailing}
  </div>);
}

/** Queue filter chips (All, Ranked Solo/Duo, Flex, Normal Draft, Blind, ARAM, Arena, Other). The choice is remembered per device by the caller. */
export function QueueFilterChips({ value, onChange }: { value: QueueFilter; onChange: (q: QueueFilter) => void }) {
  return (<div role="group" aria-label="Queue filter" className="flex flex-wrap items-center gap-2">
    {QUEUE_FILTERS.map((f) => <Chip key={f.key} active={value === f.key} onClick={() => onChange(f.key)}>{f.label}</Chip>)}
  </div>);
}

const ROLES = Object.keys(ROLE_LABEL) as Role[];
/**
 * Role chips and a champion picker for a match list. Picking the active role again clears it. `champions` are the champions to offer (Profile: the player's pool);
 * a chosen champion that is not in the list is still shown, so the select never lies about the active filter.
 */
export function MatchFilterChips({ value, onChange, champions }: { value: MatchFilter; onChange: (f: MatchFilter) => void; champions: { id: string; name: string }[] }) {
  const { champion, role } = value, options = champion && !champions.some((c) => c.id === champion) ? [{ id: champion, name: champion }, ...champions] : champions;
  const set = (f: MatchFilter) => onChange({ ...(f.champion ? { champion: f.champion } : {}), ...(f.role ? { role: f.role } : {}) });
  return (<div role="group" aria-label="Role and champion filter" className="flex flex-wrap items-center gap-2">
    {ROLES.map((r) => <Chip key={r} active={role === r} onClick={() => set({ champion, role: role === r ? undefined : r })}>{ROLE_LABEL[r]}</Chip>)}
    <select aria-label="Champion" value={champion ?? ""} onChange={(e) => set({ role, champion: e.target.value || undefined })}
      className="focus-ring h-8 px-2 rounded-md bg-raised border border-line/10 text-xs">
      <option value="">All champions</option>
      {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
    {(champion || role) && <button className="focus-ring text-xs text-muted hover:text-text underline rounded" onClick={() => onChange({})}>Clear</button>}
  </div>);
}

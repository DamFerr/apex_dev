import type { ReactNode } from "react";
import { timeAgo } from "@apex/stats-core";
import type { MatchSummary, QueueFilter } from "@apex/schema";
import { QUEUE_FILTERS } from "@apex/schema";
import { ChampIcon } from "./ChampIcon";
import { LoadoutIcons } from "./LoadoutIcons";
import { RoleIcon } from "./RoleIcon";
import { Chip } from "./ui";
import { useChampName } from "../lib/ddragon";

/**
 * One finished game as a dense row, the same on Profile and Home: champion icon with its level, name, result and how long ago, K/D/A with CS,
 * role, loadout icons (spells, keystone, items), queue and length. The coloured strip on the left is the result (and the word Win/Loss is kept
 * next to it, so colour is never the only signal). `trailing` is the expand arrow on Profile.
 */
export function MatchRowBody({ m, trailing }: { m: MatchSummary; trailing?: ReactNode }) {
  const champName = useChampName(), name = champName(m.champion), kda = m.deaths === 0 ? "Perfect" : ((m.kills + m.assists) / m.deaths).toFixed(2);
  return (<div className="flex items-center gap-4 w-full">
    <span className="relative shrink-0" title={`${name}${m.level ? `, level ${m.level}` : ""}`}>
      <ChampIcon id={m.champion} name={name} size={40} />
      {m.level ? <span aria-hidden className="absolute -right-1 -bottom-1 rounded bg-base border border-line/30 text-[10px] leading-4 px-1 tabular-nums">{m.level}</span> : null}
    </span>
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

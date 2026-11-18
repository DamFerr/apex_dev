import type { Loadout } from "@apex/schema";
import { GameIcon } from "./GameIcon";

/** A player's summoner spells, runes (keystone + secondary tree), six item slots, the role item slot and the trinket as one compact row of icons. Empty item slots stay as blanks so rows line up. */
export function LoadoutIcons({ loadout, size = 22 }: { loadout: Loadout; size?: number }) {
  const slots = Array.from({ length: 6 }, (_, i) => loadout.items[i]), blank = { width: size, height: size };
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Loadout">
      <div className="flex gap-0.5">{loadout.spells.map((s, i) => <GameIcon key={i} kind="spell" id={s} size={size} />)}</div>
      <div className="flex items-center gap-0.5">
        {loadout.keystone !== null && <GameIcon kind="rune" id={loadout.keystone} size={size} />}
        {loadout.secondaryStyle !== null && <GameIcon kind="rune" id={loadout.secondaryStyle} size={Math.round(size * 0.7)} className="opacity-70" />}
      </div>
      <div className="flex items-center gap-0.5">
        {slots.map((id, i) => id ? <GameIcon key={i} kind="item" id={id} size={size} /> : <span key={i} aria-hidden style={blank} className="rounded-md bg-base/40 border border-line/10" />)}
        {/* The role quest item (ADC boots, jungle pet, support item) always has the same place after the six slots, ringed, so it is never mistaken for a normal item. */}
        <span title="Role item" className="ml-1 inline-flex rounded-md" style={blank}>
          {loadout.roleItem ? <span className="inline-flex rounded-md ring-1 ring-accent/60"><GameIcon kind="item" id={loadout.roleItem} size={size} /></span> : <span aria-hidden style={blank} className="rounded-md border border-dashed border-line/10" />}
        </span>
        {loadout.trinket && <GameIcon kind="item" id={loadout.trinket} size={size} round className="ml-1" />}
      </div>
    </div>
  );
}

import type { Loadout } from "@apex/schema";
import { GameIcon } from "./GameIcon";

/** A player's summoner spells, runes (keystone + secondary tree), six item slots and trinket as one compact row of icons. Empty item slots stay as blanks so rows line up. */
export function LoadoutIcons({ loadout, size = 22 }: { loadout: Loadout; size?: number }) {
  const slots = Array.from({ length: 6 }, (_, i) => loadout.items[i]), blank = { width: size, height: size };
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Loadout">
      <div className="flex gap-0.5">{loadout.spells.map((s, i) => <GameIcon key={i} kind="spell" id={s} size={size} />)}</div>
      <div className="flex items-center gap-0.5">
        {loadout.keystone !== null && <GameIcon kind="rune" id={loadout.keystone} size={size} />}
        {loadout.secondaryStyle !== null && <GameIcon kind="rune" id={loadout.secondaryStyle} size={Math.round(size * 0.7)} className="opacity-70" />}
      </div>
      <div className="flex gap-0.5">
        {slots.map((id, i) => id ? <GameIcon key={i} kind="item" id={id} size={size} /> : <span key={i} aria-hidden style={blank} className="rounded-md bg-base/40 border border-line/10" />)}
        {loadout.trinket && <GameIcon kind="item" id={loadout.trinket} size={size} round className="ml-0.5" />}
      </div>
    </div>
  );
}

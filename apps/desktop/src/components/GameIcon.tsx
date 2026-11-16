import { useState, type ReactNode } from "react";
import { SHARD_ICONS, SHARD_NAMES, SPELL_NAMES } from "@apex/lcu-core";
import { itemIconUrl, passiveIconUrl, runeIconUrl, spellIconUrl, useChampionAbilities, useDdVersion, useItemNames, useRuneLookup, useSummonerSpells, type AbilitySlot } from "../lib/ddragon";

/**
 * One icon component for everything the game has a picture for: items, summoner spells, runes (and rune trees), stat shards and champion abilities.
 * Images come from Riot's Data Dragon CDN at runtime (never bundled, see docs/COMPLIANCE.md). The name is always the accessible name and the tooltip;
 * while the image loads a pulsing placeholder shows, and if the image or the lookup is unavailable (offline, unknown id) the name's initials show instead.
 */
export type GameIconProps = { size?: number; round?: boolean; /** Small number badge, e.g. x2 for two potions. */ count?: number; className?: string } & (
  | { kind: "item"; id: number; /** Pass the name when you already have it (the backend sends it for builds); otherwise it is looked up in Data Dragon. */ name?: string }
  | { kind: "spell"; id: number }
  | { kind: "rune"; id: number }
  | { kind: "shard"; id: number }
  | { kind: "ability"; champion: string; slot: AbilitySlot; /** Show the key letter (Q, W, E, R) in the corner. Default true. */ keyBadge?: boolean });

const initials = (name: string) => name.split(/[\s']+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

interface BoxProps { url?: string; name: string; pending: boolean; size: number; round?: boolean; count?: number; badge?: ReactNode; className?: string; fallback?: string }
/** The shared visual: placeholder while loading, image when ready, initials when there is no image. */
export function IconBox({ url, name, pending, size, round, count, badge, className = "", fallback }: BoxProps) {
  // Status belongs to one url: when the url changes (version or lookup arrives) the new image starts in "loading" again.
  const [st, setSt] = useState<{ url?: string; status: "ready" | "failed" }>();
  const state: "loading" | "ready" | "failed" = st && st.url === url ? st.status : "loading", setState = (status: "ready" | "failed") => setSt({ url, status });
  const shape = round ? "rounded-full" : "rounded-md", box = { width: size, height: size };
  const showImg = !!url && state !== "failed";
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={box} title={name}>
      {showImg
        ? <>
            {state === "loading" && <span aria-hidden className={`absolute inset-0 ${shape} bg-raised animate-pulse`} />}
            <img src={url} alt={name} width={size} height={size} loading="lazy" decoding="async" onLoad={() => setState("ready")} onError={() => setState("failed")}
              className={`${shape} bg-base/60 transition-opacity ${state === "ready" ? "opacity-100" : "opacity-0"}`} />
          </>
        : pending && !url
          ? <span role="img" aria-label={name} className={`block ${shape} bg-raised animate-pulse`} style={box} />
          : <span role="img" aria-label={name} className={`grid place-items-center ${shape} bg-raised border border-line/10 text-muted font-semibold leading-none`} style={{ ...box, fontSize: Math.max(9, Math.round(size / 3.2)) }}>{fallback ?? initials(name)}</span>}
      {badge}
      {count !== undefined && count > 1 && <span aria-hidden className="absolute -right-1 -bottom-1 rounded bg-base text-[10px] px-1 border border-line/20">×{count}</span>}
    </span>
  );
}

function Item({ id, name, ...rest }: { id: number; name?: string } & Omit<BoxProps, "url" | "name" | "pending">) {
  const v = useDdVersion(), names = useItemNames();   // the list is shared and cached, so many icons cost one request
  return <IconBox {...rest} name={name ?? names.data?.get(id) ?? `Item ${id}`} url={v.data ? itemIconUrl(v.data, id) : undefined} pending={v.isLoading} />;
}
function Spell({ id, ...rest }: { id: number } & Omit<BoxProps, "url" | "name" | "pending">) {
  const v = useDdVersion(), spells = useSummonerSpells(), sp = spells.data?.get(id);
  return <IconBox {...rest} name={sp?.name ?? SPELL_NAMES[id] ?? `Spell ${id}`} url={v.data && sp ? spellIconUrl(v.data, sp.image) : undefined} pending={v.isLoading || spells.isLoading} />;
}
function Rune({ id, ...rest }: { id: number } & Omit<BoxProps, "url" | "name" | "pending">) {
  const runes = useRuneLookup(), r = runes.get(id), loading = useDdVersion().isLoading;
  return <IconBox {...rest} name={r?.name ?? `Rune ${id}`} url={r?.icon ? runeIconUrl(r.icon) : undefined} pending={loading && !r} fallback={r ? undefined : "?"} round />;
}
function Shard({ id, ...rest }: { id: number } & Omit<BoxProps, "url" | "name" | "pending">) {
  return <IconBox {...rest} name={SHARD_NAMES[id] ?? `Shard ${id}`} url={SHARD_ICONS[id] ? runeIconUrl(SHARD_ICONS[id]) : undefined} pending={false} round />;
}
function Ability({ champion, slot, keyBadge = true, ...rest }: { champion: string; slot: AbilitySlot; keyBadge?: boolean } & Omit<BoxProps, "url" | "name" | "pending">) {
  const v = useDdVersion(), ab = useChampionAbilities(champion), a = ab.data?.[slot];
  const label = a ? `${slot === "P" ? "Passive" : slot}: ${a.name}` : slot === "P" ? "Passive" : `Skill ${slot}`;
  const badge = keyBadge && slot !== "P" ? <span aria-hidden className="absolute -right-1 -bottom-1 rounded bg-base text-[10px] font-semibold px-1 border border-line/30 leading-4">{slot}</span> : undefined;
  return <IconBox {...rest} name={label} fallback={slot} badge={badge} url={v.data && a ? (a.passive ? passiveIconUrl(v.data, a.image) : spellIconUrl(v.data, a.image)) : undefined} pending={v.isLoading || ab.isLoading} />;
}

export function GameIcon(p: GameIconProps) {
  const { size = 36, round, count, className } = p, common = { size, count, className, round };
  switch (p.kind) {
    case "item": return <Item id={p.id} name={p.name} {...common} />;
    case "spell": return <Spell id={p.id} {...common} />;
    case "rune": return <Rune id={p.id} {...common} />;
    case "shard": return <Shard id={p.id} {...common} />;
    case "ability": return <Ability champion={p.champion} slot={p.slot} keyBadge={p.keyBadge} {...common} />;
  }
}

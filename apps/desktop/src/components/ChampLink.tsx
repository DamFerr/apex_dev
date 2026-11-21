import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChampIcon } from "./ChampIcon";
import { resolveChampId, useDdChampions } from "../lib/ddragon";
import { championPath } from "../lib/nav";

/** Where a champion link goes: always the champion page, with the id spelled the way Data Dragon does (case-insensitive match). */
const usePath = (id: string) => championPath(resolveChampId(id, useDdChampions().data));

/**
 * A champion's name as a link to its champion page (the same idea as a player's name linking to their profile).
 * Use it inside a row, card or table cell; never inside a button (a link in a button is invalid and breaks keyboard use).
 * `onClick` stops the click from reaching a clickable parent.
 */
export function ChampLink({ id, name, className = "", children }: { id: string; name: string; className?: string; children?: ReactNode }) {
  return <Link to={usePath(id)} title={`Open ${name}`} onClick={(e) => e.stopPropagation()} className={`focus-ring rounded hover:underline ${className}`}>{children ?? name}</Link>;
}

/**
 * A champion icon as a link to its champion page. `alone` means no name link sits next to it, so the icon is the one keyboard stop and is
 * labelled for screen readers; otherwise it is a mouse-only extra target and the name link is the keyboard and screen-reader one.
 */
export function ChampIconLink({ id, name, size, alone = false }: { id: string; name: string; size?: number; alone?: boolean }) {
  return (
    <Link to={usePath(id)} title={`Open ${name}`} onClick={(e) => e.stopPropagation()} className="focus-ring rounded-md shrink-0 hover:brightness-110 transition"
      {...(alone ? { "aria-label": `Open ${name}` } : { "aria-hidden": true, tabIndex: -1 })}>
      <ChampIcon id={id} name={name} size={size} />
    </Link>
  );
}

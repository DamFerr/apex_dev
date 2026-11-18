import { useEffect, useMemo, useRef, useState } from "react";
import { ChampIcon } from "./ChampIcon";
import { Button } from "./ui";
import type { DdChampion } from "../lib/ddragon";
import { searchChampions } from "../lib/searchMatch";

/** Searchable champion grid for the draft what-if (G.3). Taken champions are shown but disabled; Enter picks the best free match; Esc closes. */
export function ChampionPicker({ champs, taken, title, onPick, onClear, onClose }: {
  champs: readonly DdChampion[]; taken: ReadonlySet<number>; title: string;
  onPick: (key: number) => void; onClear?: () => void; onClose: () => void;
}) {
  const [q, setQ] = useState(""), input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const list = useMemo(() => (q.trim() ? searchChampions(champs, q, champs.length) : [...champs].sort((a, b) => a.name.localeCompare(b.name, "en"))), [champs, q]);
  const firstFree = list.find((c) => !taken.has(c.key));
  return (
    <section className="glass rounded-lg p-4" aria-label={title} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="font-display text-[1rem] font-semibold">{title}</div>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search champion" aria-label="Search champion"
          onKeyDown={(e) => { if (e.key === "Enter" && firstFree) onPick(firstFree.key); }}
          className="focus-ring ml-auto h-9 w-52 rounded-md bg-raised/60 border border-line/10 px-3 text-sm" />
        {onClear && <Button variant="ghost" onClick={onClear}>Empty slot</Button>}
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 max-h-64 overflow-y-auto">
        {list.map((c) => (
          <li key={c.key}>
            <button type="button" disabled={taken.has(c.key)} onClick={() => onPick(c.key)} title={taken.has(c.key) ? `${c.name} (already picked or banned)` : c.name} aria-label={c.name}
              className="focus-ring rounded-md p-0.5 hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed"><ChampIcon id={c.id} name={c.name} size={40} /></button>
          </li>))}
        {!list.length && <li className="col-span-full text-xs text-muted">No champion matches.</li>}
      </ul>
    </section>
  );
}

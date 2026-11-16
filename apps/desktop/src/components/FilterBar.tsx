import { useEffect } from "react";
import { useFilterOptions } from "../lib/api";
import { platformName, rankLabel, TIERS } from "../lib/platforms";
import { useUi } from "../lib/store";

type Opt = { value: string; label: string };
const sel = "focus-ring h-8 px-2 rounded-md bg-raised border border-line/10 text-sm";

/**
 * One filter bar for every stats view, so all pages agree on region, patch and rank.
 * Every region and rank is always offered, like the big stats sites; options the collector has not filled in yet say so.
 * Ranks are cumulative: "Emerald+" is Emerald IV and everything above it. Patches: only the newest 5 exist, "Last 5 patches" combines them.
 */
export function FilterBar() {
  const f = useUi((s) => s.statsFilter), patch = useUi((s) => s.patch), o = useFilterOptions().data;
  const n = (c: number) => (c > 0 ? ` · ${c.toLocaleString()} games` : " · no data yet");
  const regionList = [...(o?.platforms ?? [])].sort((a, b) => b.matches - a.matches || platformName(a.id).localeCompare(platformName(b.id)));
  const regions: Opt[] = [{ value: "all", label: "All regions (global)" }, ...regionList.map((p) => ({ value: p.id, label: platformName(p.id) + n(p.matches) }))];
  // Apex keeps only the newest 5 patches. A patch saved in the settings that has been removed since falls back to the latest one.
  useEffect(() => {
    if (o?.patches.length && f.patch !== "latest" && f.patch !== "all" && !o.patches.some((p) => p.id === f.patch)) patch({ statsFilter: { ...f, patch: "latest" } });
  }, [o, f, patch]);
  const patches: Opt[] = [{ value: "latest", label: "Latest patch" }, { value: "all", label: "Last 5 patches" }, ...(o?.patches ?? []).map((p) => ({ value: p.id, label: `Patch ${p.id}` + n(p.matches) }))];
  // "All ranks" is Iron and above, so Iron has no separate entry.
  const ranks: Opt[] = [{ value: "all", label: "All ranks (Iron+)" }, ...TIERS.slice(1).map((t) => ({ value: t, label: rankLabel(t) + n(o?.ranks.find((r) => r.id === t)?.matches ?? 0) }))];
  const current = (key: "platform" | "patch" | "rank") => (key === "rank" ? f.rank.replace("+", "").replace(/^IRON$/, "all") : f[key]); // older saved values
  const field = (label: string, key: "platform" | "patch" | "rank", opts: Opt[]) => {
    const value = current(key), options = opts.some((x) => x.value === value) ? opts : [...opts, { value, label: `${value} (no data)` }];
    return (
      <label className="flex items-center gap-2 text-xs text-muted">{label}
        <select aria-label={label} value={value} title={key === "rank" ? "A rank always means that rank and everything above it" : undefined} className={sel} onChange={(e) => patch({ statsFilter: { ...f, [key]: e.target.value } })}>
          {options.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
      </label>);
  };
  return (
    <div role="group" aria-label="Statistics filters" className="flex flex-wrap items-center gap-4 mb-4">
      {field("Region", "platform", regions)}{field("Patch", "patch", patches)}{field("Rank", "rank", ranks)}
      {(f.platform !== "all" || f.patch !== "latest" || current("rank") !== "all") && <button className="focus-ring text-xs text-muted hover:text-text underline rounded" onClick={() => patch({ statsFilter: { platform: "all", patch: "latest", rank: "all" } })}>Reset filters</button>}
    </div>
  );
}

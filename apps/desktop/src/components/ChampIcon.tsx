import { useState } from "react";
import { iconUrl, resolveChampId, useDdChampions, useDdVersion } from "../lib/ddragon";

export function ChampIcon({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const v = useDdVersion(), list = useDdChampions().data, [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (!v.data || failed) return <div style={box} className="rounded-md bg-raised grid place-items-center text-xs font-semibold text-muted shrink-0" aria-hidden>{name[0]}</div>;
  return <img src={iconUrl(v.data, resolveChampId(id, list))} alt="" style={box} onError={() => setFailed(true)} className="rounded-md shrink-0 border border-line/10" />;
}

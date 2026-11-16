import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { RIOT_ID_RE } from "../lib/riotId";
import { useUi } from "../lib/store";
import { toast } from "../lib/toast";

export function SearchBox() {
  const nav = useNavigate(), addRecent = useUi((s) => s.addRecent), [v, setV] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = v.trim();
    if (!RIOT_ID_RE.test(id)) return toast("Enter a Riot ID like Name#TAG", "error");
    addRecent(id); setV(""); nav(`/profile/${encodeURIComponent(id)}`);
  };
  return (
    <form onSubmit={submit} role="search" className="relative max-w-md">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input aria-label="Riot ID" value={v} onChange={(e) => setV(e.target.value)} placeholder="Search any Riot ID in any region, e.g. Name#EUW"
        className="focus-ring w-full h-10 pl-9 pr-3 rounded-md bg-raised/60 border border-line/10 text-sm placeholder:text-muted" />
    </form>
  );
}


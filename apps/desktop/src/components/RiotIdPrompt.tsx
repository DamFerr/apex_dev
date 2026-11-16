import { useState, type FormEvent } from "react";
import { Button } from "./ui";
import { RIOT_ID_RE } from "../lib/riotId";
import { useUi } from "../lib/store";

/** Shown wherever a screen needs your own Riot ID and none is saved yet. */
export function RiotIdPrompt() {
  const patch = useUi((s) => s.patch), [v, setV] = useState(""), [err, setErr] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault(); const id = v.trim();
    if (RIOT_ID_RE.test(id)) patch({ myRiotId: id }); else setErr(true);
  };
  return (
    <form onSubmit={submit} className="glass rounded-lg p-6 max-w-xl space-y-3">
      <div className="font-display text-lg font-semibold">Add your Riot ID</div>
      <p className="text-sm text-muted">Apex uses it for your rank, recent games, recap and personal champion pool. Your region is found automatically. It is stored only on this device.</p>
      <div className="flex items-center gap-2">
        <input aria-label="Your Riot ID" value={v} onChange={(e) => { setV(e.target.value); setErr(false); }} placeholder="Name#TAG"
          className="focus-ring h-10 w-64 px-3 rounded-md bg-raised/60 border border-line/10 text-sm placeholder:text-muted" />
        <Button type="submit">Save</Button>
      </div>
      {err && <p role="alert" className="text-xs text-bad">Enter a Riot ID like Name#TAG</p>}
    </form>
  );
}

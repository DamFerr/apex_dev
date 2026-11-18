import { Radio, RefreshCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui";
import { useLiveGame } from "../lib/api";
import { RIOT_ID_RE } from "../lib/riotId";
import { useUi } from "../lib/store";
import { toast } from "../lib/toast";
import { LiveGameView } from "./LiveGameView";

export function LiveGame() {
  const me = useUi((s) => s.myRiotId), addRecent = useUi((s) => s.addRecent), nav = useNavigate();
  const { riotId } = useParams(), id = riotId ? decodeURIComponent(riotId) : me, [v, setV] = useState(id);
  useEffect(() => setV(id), [id]);
  const q = useLiveGame(id);
  const submit = (e: FormEvent) => {
    e.preventDefault(); const next = v.trim();
    if (!RIOT_ID_RE.test(next)) return toast("Enter a Riot ID like Name#TAG", "error");
    addRecent(next); nav(`/live/${encodeURIComponent(next)}`);
  };
  return (<>
    <h1 className="font-display text-3xl font-semibold tracking-tight">Live Game</h1>
    <p className="text-sm text-muted mt-1 mb-5">See who is in a game right now: rank and champion form for all ten players. Only information the game&apos;s loading screen already shows, plus public rank data.</p>
    <form onSubmit={submit} role="search" className="flex flex-wrap items-center gap-2 mb-5">
      <input aria-label="Riot ID to scout" value={v} onChange={(e) => setV(e.target.value)} placeholder="Name#TAG"
        className="focus-ring h-10 w-72 px-3 rounded-md bg-raised/60 border border-line/10 text-sm placeholder:text-muted" />
      <Button type="submit"><Radio size={15} />Look up</Button>
      <Button type="button" variant="ghost" onClick={() => void q.refetch()} disabled={q.isFetching}><RefreshCw size={15} className={q.isFetching ? "animate-spin" : ""} />Refresh</Button>
    </form>
    {!id && <div className="glass rounded-lg p-6 text-sm text-muted max-w-xl">Enter a Riot ID above, or add your own in Settings.</div>}
    {id && <LiveGameView id={id} />}
  </>);
}

import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Chip, spring } from "../components/ui";
import { combo } from "../lib/hotkeys";
import { useFilterOptions } from "../lib/api";
import { collectorCommand, useCollector } from "../lib/collector";
import { platformName } from "../lib/platforms";
import { RIOT_ID_RE } from "../lib/riotId";
import { toast } from "../lib/toast";
import { useUi, type OverlayCorner, type Theme } from "../lib/store";
import { useDraft } from "../lib/lcu";
import { useOverlayPreview } from "../lib/overlay";
import { isTauri } from "../lib/tauri";

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="glass rounded-lg p-5 space-y-4"><h2 className="font-display text-lg font-semibold">{title}</h2>{children}</section>);
const Row = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-6"><div><div className="text-sm">{label}</div>{hint && <div className="text-[11px] text-muted max-w-sm">{hint}</div>}</div>{children}</div>);

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`focus-ring w-11 h-6 rounded-full p-0.5 flex transition-colors ${on ? "bg-accent justify-end" : "bg-raised justify-start"}`}>
      <motion.span layout transition={spring} className="size-5 rounded-full bg-white" /></button>);
}

function HotkeyField({ id, label }: { id: string; label: string }) {
  const { hotkeys, patch } = useUi(), [rec, setRec] = useState(false);
  useEffect(() => {
    if (!rec) return;
    const h = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); /* recording must not also trigger the hotkey */ if (e.key === "Escape") return setRec(false);
      const c = combo(e); if (c) { patch({ hotkeys: { ...hotkeys, [id]: c } }); setRec(false); } };
    window.addEventListener("keydown", h, true); return () => window.removeEventListener("keydown", h, true);
  }, [rec, id, hotkeys, patch]);
  return <Row label={label}><button onClick={() => setRec(true)} className="focus-ring min-w-36 h-8 px-3 rounded-md bg-raised/60 border border-line/10 text-xs">{rec ? "Press keys… (Esc to cancel)" : hotkeys[id]}</button></Row>;
}

async function testBackend(base: string) {
  try {
    const r = await fetch(`${base}/health`), j = (await r.json()) as { ok: boolean; hasKey: boolean };
    toast(j.ok && j.hasKey ? "Local backend is running and has an API key" : "Backend is running but has no API key", j.hasKey ? "info" : "error");
  } catch { toast("Can't reach the local backend. Start it with: pnpm api", "error"); }
}

function CollectorRow() {
  const { data, refetch } = useCollector(), base = useUi((s) => s.backendUrl), cover = useFilterOptions(false).data;
  const act = async (cmd: "start" | "stop") => { try { await collectorCommand(base, cmd); await refetch(); } catch { toast("Can't reach the local backend. Start it with: pnpm api", "error"); } };
  const withData = (cover?.platforms ?? []).filter((p) => p.matches > 0).sort((a, b) => b.matches - a.matches);
  return (
    <Row label="Data collector" hint="Runs by itself whenever the backend is running and covers every region and rank, using half of your Riot rate limit. You can pause it, and everything keeps working with what is already collected.">
      <div className="text-right space-y-2 max-w-md">
        <div className="text-sm" aria-live="polite">{data ? `${data.running ? "Collecting" : "Paused"} · ${data.matches.toLocaleString()} games · ${data.crawled.toLocaleString()} players crawled · ladders ${data.ladders.seeded}/${data.ladders.total}` : "Backend not reachable"}</div>
        {data && withData.length > 0 && <div className="text-xs text-muted">{withData.map((p) => `${platformName(p.id)} ${p.matches.toLocaleString()}`).join(" · ")}</div>}
        {data?.lastError && <div className={`text-xs ${data.fatal ? "text-bad" : "text-muted"}`}>{data.fatal ? data.lastError : `Recent hiccup, retrying automatically: ${data.lastError}`}</div>}
        <Button variant="ghost" disabled={!data} onClick={() => void act(data?.running ? "stop" : "start")}>{data?.running ? "Pause collector" : "Resume collector"}</Button>
      </div>
    </Row>
  );
}

const CORNERS: [OverlayCorner, string][] = [["top-left", "Top left"], ["top-right", "Top right"], ["bottom-left", "Bottom left"], ["bottom-right", "Bottom right"]];
function OverlayCard() {
  const u = useUi(), { preview, set } = useOverlayPreview();
  const hasSpot = u.overlayMonitor !== null;   // a dragged position is saved: it wins over the corner preset until reset
  return (
    <Card title="In-game overlay">
      <Row label="Show during games" hint={isTauri ? "A small card with the usual build of the champion you locked in (skill order, items), from collected games. It appears only while a game is running and shows nothing that is not already known in champ select. Drag it with the left mouse button to move it; every other click goes to the game, and it never takes the keyboard. Off by default." : "Needs the desktop app (pnpm tauri dev); the browser preview has no overlay window."}>
        <Toggle on={u.overlayEnabled} onChange={(v) => u.patch({ overlayEnabled: v })} label="Show overlay during games" /></Row>
      <Row label="Opacity"><div className="flex items-center gap-3"><input type="range" min={0.4} max={1} step={0.05} value={u.overlayOpacity} aria-label="Overlay opacity" onChange={(e) => u.patch({ overlayOpacity: Number(e.target.value) })} className="w-40 accent-[rgb(var(--accent))]" /><span className="w-10 text-right text-xs tabular-nums text-muted">{Math.round(u.overlayOpacity * 100)}%</span></div></Row>
      <Row label="Position"><div className="flex flex-wrap justify-end gap-2" role="group" aria-label="Overlay position">{CORNERS.map(([k, label]) => <Chip key={k} active={!hasSpot && u.overlayCorner === k} onClick={() => u.patch({ overlayCorner: k, overlayPositions: {}, overlayMonitor: null })}>{label}</Chip>)}</div></Row>
      <Row label="Dragged position" hint="After you drag the card in a game, Apex remembers the spot. Reset puts it back in the chosen corner."><Button variant="ghost" disabled={!hasSpot} onClick={() => u.resetOverlayPosition()}>Reset position</Button></Row>
      <Row label="Preview" hint="Shows the overlay now, wherever you are, to check its position and opacity. It shows the champion from your last champ select.">
        <Button variant="ghost" disabled={!isTauri} aria-pressed={preview} onClick={() => set(!preview)}>{preview ? "Hide preview" : "Show preview"}</Button></Row>
    </Card>);
}

export function Settings() {
  const u = useUi(), themes: Theme[] = ["dark", "light", "colorblind"], connected = useDraft((s) => s.draft.connected);
  return (
    <div className="space-y-4 max-w-2xl">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-1">Changes save automatically on this device.</p></div>
      <Card title="Appearance">
        <Row label="Theme"><div className="flex gap-2">{themes.map((t) => <Chip key={t} active={u.theme === t} onClick={() => u.setTheme(t)}>{t === "colorblind" ? "Colorblind-safe" : t[0].toUpperCase() + t.slice(1)}</Chip>)}</div></Row>
        <Row label="Reduce motion" hint="Turns animations off. Also follows your system setting."><Toggle on={u.reduceMotion} onChange={u.setReduceMotion} label="Reduce motion" /></Row>
        <Row label="Auto compact in champ select" hint="Shrinks the window to a narrow panel when champ select starts, and restores it after."><Toggle on={u.autoCompact} onChange={(v) => u.patch({ autoCompact: v })} label="Auto compact" /></Row>
        <Row label="Open Draft when champ select starts" hint="Switches Apex to the Draft page the moment a draft begins. Only moves inside Apex."><Toggle on={u.autoOpenDraft} onChange={(v) => u.patch({ autoOpenDraft: v })} label="Open Draft automatically" /></Row>
      </Card>
      <Card title="Champ select">
        <Row label="Flash key" hint="Which key your Flash is on in the game: D (left) or F (right). Only used when Apex sets your spells in champ select. On the champion page Flash is always shown on the left; a player's own games and the live game show their real order. Pairs without Flash are left as they are.">
          <div className="flex gap-2" role="group" aria-label="Flash key">{(["D", "F"] as const).map((k) => <Chip key={k} active={u.flashSlot === k} onClick={() => u.patch({ flashSlot: k })}>{k === "D" ? "D (left)" : "F (right)"}</Chip>)}</div></Row>
      </Card>
      <OverlayCard />
      <Card title="League client">
        <Row label="Status" hint="Apex finds the client by itself. If League isn’t in C:\Riot Games\League of Legends, set the LOL_LOCKFILE environment variable.">
          <span className="flex items-center gap-2 text-sm"><span className={`size-1.5 rounded-full ${connected ? "bg-good" : "bg-gold"}`} />{connected ? "Connected" : "Not detected"}</span></Row>
      </Card>
      <Card title="Data">
        <Row label="Your Riot ID" hint="Home, Profile and the Draft assistant use this. Your region is found automatically. Example: Name#EUW">
          <input aria-label="Your Riot ID" defaultValue={u.myRiotId} key={u.myRiotId} placeholder="Name#TAG" className="focus-ring h-8 w-52 px-3 rounded-md bg-raised/60 border border-line/10 text-sm placeholder:text-muted"
            onBlur={(e) => { const v = e.target.value.trim(); if (v === u.myRiotId) return; if (v === "" || RIOT_ID_RE.test(v)) u.patch({ myRiotId: v }); else { toast("Riot ID must look like Name#TAG", "error"); e.target.value = u.myRiotId; } }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></Row>
        <Row label="Refresh my rank after each game" hint="When a game you played ends, Apex looks up your own rank again (twice, 30 s and 2 min later) so Home, Profile and LP history are current. Needs your Riot ID and the League client; nothing else is looked up.">
          <Toggle on={u.autoRefreshRank} onChange={(v) => u.patch({ autoRefreshRank: v })} label="Refresh my rank after each game" /></Row>
        <CollectorRow />
        <Row label="Backend" hint={u.backendUrl}><Button variant="ghost" onClick={() => void testBackend(u.backendUrl)}>Test connection</Button></Row>
      </Card>
      <Card title="Hotkeys">
        <Row label="Command palette"><kbd className="rounded border border-line/15 px-2 py-1 text-xs text-muted">Ctrl+K (fixed)</kbd></Row>
        <HotkeyField id="compactToggle" label="Toggle compact mode" />
        <p className="text-[11px] text-muted">Hotkeys work while Apex is focused.</p>
      </Card>
      <Card title="Privacy">
        <Row label="Local data" hint="Settings and recent searches are stored only on this device. No Riot API key is ever stored in the app.">
          <Button variant="ghost" onClick={() => { if (window.confirm("Reset all Apex settings and recent searches on this device?")) { localStorage.clear(); location.reload(); } }}>Reset local data</Button></Row>
        <p className="text-[11px] text-muted">Apex isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
      </Card>
    </div>
  );
}

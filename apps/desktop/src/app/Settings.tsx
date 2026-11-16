import { emit } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Chip, spring } from "../components/ui";
import { combo } from "../lib/hotkeys";
import { useFilterOptions } from "../lib/api";
import { collectorCommand, useCollector } from "../lib/collector";
import { platformName } from "../lib/platforms";
import { RIOT_ID_RE } from "../lib/riotId";
import { toast } from "../lib/toast";
import { useUi, type Theme } from "../lib/store";
import { isTauri } from "../lib/tauri";

const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="glass rounded-lg p-5 space-y-4"><h2 className="font-display text-lg font-semibold">{title}</h2>{children}</section>);
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
    const h = (e: KeyboardEvent) => { e.preventDefault(); if (e.key === "Escape") return setRec(false);
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
  const { data, refetch } = useCollector(), base = useUi((s) => s.backendUrl), cover = useFilterOptions().data;
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

export function Settings() {
  const u = useUi(), themes: Theme[] = ["dark", "light", "colorblind"];
  const setOpacity = (v: number) => { u.patch({ overlayOpacity: v }); if (isTauri) emit("overlay-opacity", v); };
  return (
    <div className="space-y-4 max-w-2xl">
      <div><h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-1">Changes save automatically on this device.</p></div>
      <Card title="Appearance">
        <Row label="Theme"><div className="flex gap-2">{themes.map((t) => <Chip key={t} active={u.theme === t} onClick={() => u.setTheme(t)}>{t === "colorblind" ? "Colorblind-safe" : t[0].toUpperCase() + t.slice(1)}</Chip>)}</div></Row>
        <Row label="Reduce motion" hint="Turns animations off. Also follows your system setting."><Toggle on={u.reduceMotion} onChange={u.setReduceMotion} label="Reduce motion" /></Row>
        <Row label="Auto compact in champ select" hint="Shrinks the window to a narrow panel when champ select starts, and restores it after."><Toggle on={u.autoCompact} onChange={(v) => u.patch({ autoCompact: v })} label="Auto compact" /></Row>
      </Card>
      <Card title="League client">
        <Row label="Source" hint="Real works in the native window only. If League isn’t in C:\Riot Games\League of Legends, set the LOL_LOCKFILE environment variable.">
          <div className="flex gap-2"><Chip active={u.lcuSource === "mock"} onClick={() => u.setLcuSource("mock")}>Mock (dev)</Chip><Chip active={u.lcuSource === "real"} onClick={() => u.setLcuSource("real")}>Real client</Chip></div></Row>
      </Card>
      <Card title="Data">
        <Row label="Your Riot ID" hint="Home, Recap, Live Game and Draft use this. Your region is found automatically. Example: Name#EUW">
          <input aria-label="Your Riot ID" defaultValue={u.myRiotId} key={u.myRiotId} className="focus-ring h-8 w-52 px-3 rounded-md bg-raised/60 border border-line/10 text-sm"
            onBlur={(e) => { const v = e.target.value.trim(); if (v === u.myRiotId) return; if (RIOT_ID_RE.test(v)) u.patch({ myRiotId: v }); else { toast("Riot ID must look like Name#TAG", "error"); e.target.value = u.myRiotId; } }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></Row>
        <CollectorRow />
        <Row label="Backend" hint={u.backendUrl}><Button variant="ghost" onClick={() => void testBackend(u.backendUrl)}>Test connection</Button></Row>
      </Card>
      <Card title="Overlay">
        <Row label="Show in-game overlay" hint={isTauri ? "A transparent, always-on-top window that ignores the mouse. Content is a placeholder for now." : "Native window only."}>
          <Toggle on={u.overlayEnabled} onChange={(v) => u.patch({ overlayEnabled: v })} label="Show overlay" /></Row>
        <Row label={`Opacity ${Math.round(u.overlayOpacity * 100)}%`}>
          <input type="range" min={0.3} max={1} step={0.05} value={u.overlayOpacity} aria-label="Overlay opacity" onChange={(e) => setOpacity(Number(e.target.value))} className="w-40 accent-[rgb(var(--accent))]" /></Row>
      </Card>
      <Card title="Hotkeys">
        <Row label="Command palette"><kbd className="rounded border border-line/15 px-2 py-1 text-xs text-muted">Ctrl+K (fixed)</kbd></Row>
        <HotkeyField id="overlayToggle" label="Toggle overlay" />
        <HotkeyField id="compactToggle" label="Toggle compact mode" />
        <p className="text-[11px] text-muted">These work while Apex is focused. System-wide hotkeys arrive with the live overlay.</p>
      </Card>
      <Card title="Language">
        <Row label="Interface language" hint="More languages are planned for Phase 4."><select value={u.language} onChange={(e) => u.patch({ language: e.target.value })} aria-label="Language"
          className="focus-ring h-8 px-2 rounded-md bg-raised border border-line/10 text-sm"><option value="en">English</option><option disabled>Español (soon)</option><option disabled>한국어 (soon)</option></select></Row>
      </Card>
      <Card title="Privacy">
        <Row label="Anonymous usage telemetry" hint="Off by default. Nothing is collected or sent yet."><Toggle on={u.telemetry} onChange={(v) => u.patch({ telemetry: v })} label="Telemetry" /></Row>
        <Row label="Local data" hint="Settings and recent searches are stored only on this device. No Riot API key is ever stored in the app.">
          <Button variant="ghost" onClick={() => { if (window.confirm("Reset all Apex settings and recent searches on this device?")) { localStorage.clear(); location.reload(); } }}>Reset local data</Button></Row>
        <p className="text-[11px] text-muted">Apex isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.</p>
      </Card>
    </div>
  );
}

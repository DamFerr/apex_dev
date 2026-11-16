import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

/** In-game overlay window (groundwork, not reachable from the UI yet). Transparent, always on top, click-through (set in Rust). */
export function Overlay() {
  const [opacity, setOpacity] = useState(0.9);
  useEffect(() => {
    document.documentElement.dataset.overlay = "1";
    let off: (() => void) | undefined;
    listen<number>("overlay-opacity", (e) => setOpacity(e.payload)).then((f) => (off = f));
    return () => off?.();
  }, []);
  return <div style={{ opacity }} className="m-2 glass rounded-xl px-4 py-3 font-display text-sm font-semibold">Apex</div>;
}

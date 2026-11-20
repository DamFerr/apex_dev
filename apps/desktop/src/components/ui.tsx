import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { useUi } from "../lib/store";

export const spring = { type: "spring", stiffness: 420, damping: 28 } as const;

export function Button({ variant = "primary", className = "", ...p }:
  ComponentProps<typeof motion.button> & { variant?: "primary" | "ghost" }) {
  const base = "focus-ring rounded-md px-4 h-9 text-sm font-medium inline-flex items-center gap-2 ";
  const v = variant === "primary"
    ? "bg-accent text-white shadow-glow hover:brightness-110"
    : "bg-raised/60 border border-line/10 hover:bg-raised";
  return <motion.button whileTap={{ scale: 0.96 }} transition={spring} className={base + v + " " + className} {...p} />;
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} aria-pressed={active}
      className={`focus-ring h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
        active ? "bg-accent/20 border-accent/50 text-text" : "border-line/10 text-muted hover:text-text"}`}>
      {children}
    </motion.button>
  );
}

export function AnimatedNumber({ value, decimals = 1, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const reduce = useUi((s) => s.reduceMotion);
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => v.toFixed(decimals) + suffix);
  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const c = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
}

export function StatCard({ label, value, suffix, decimals, hint }:
  { label: string; value: number; suffix?: string; decimals?: number; hint?: string }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={spring} className="glass rounded-lg p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-display text-3xl font-semibold mt-1 tabular-nums">
        <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
      </div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </motion.div>
  );
}

/** `value` is clamped to 0..100. `tone` colours the arc (gold = no progress claim, see `lpRing`); `aria` overrides the screen reader text. */
export function ProgressRing({ value, size = 88, label, text, tone = "accent", aria }: { value: number; size?: number; label?: string; text?: string; tone?: "accent" | "gold"; aria?: string }) {
  const reduce = useUi((s) => s.reduceMotion), v = Math.min(100, Math.max(0, value)), sw = tone === "gold" ? 4 : 6; // gold ring thinner: a wide number (3604 LP) must not touch it
  const r = (size - 10) / 2, circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={aria ?? `${label ?? "Progress"} ${Math.round(v)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line) / .1)" strokeWidth={sw} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`rgb(var(--${tone}))`} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - v / 100) }} transition={{ duration: reduce ? 0 : 1, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display text-lg font-semibold">{text ?? `${Math.round(value)}%`}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-raised/70 relative overflow-hidden ${className}`}>
    <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-line/10 to-transparent"
      animate={{ x: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }} />
  </div>;
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return <span className="relative group inline-flex">{children}
    <span role="tooltip" className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md glass px-2 py-1 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">{text}</span>
  </span>;
}

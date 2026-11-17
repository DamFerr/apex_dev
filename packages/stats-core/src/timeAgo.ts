/**
 * Short "time ago" for dense lists: "now", "5m", "3h", "2d", "3w", "4mo", "2y". Floors (a game 59 minutes old is "59m", never "1h").
 * Invalid or future dates give "now" so a clock that is slightly off never shows a negative age.
 */
export function timeAgo(iso: string | number | Date, now: number = Date.now()): string {
  const t = new Date(iso).getTime(); if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000)), m = Math.floor(s / 60), h = Math.floor(s / 3600), d = Math.floor(s / 86400);
  if (m < 1) return "now";
  if (h < 1) return `${m}m`;
  if (d < 1) return `${h}h`;
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  if (d < 365) return `${Math.floor(d / 30)}mo`;
  return `${Math.floor(d / 365)}y`;
}

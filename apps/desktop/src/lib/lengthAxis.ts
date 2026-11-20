/**
 * Vertical range (percent) for the win-rate-by-length chart. A champion's rate barely moves with game length, so a 0-100 axis would draw a
 * flat line: zoom to the data (all rates and the overall rate, 1 point of padding), never narrower than `minSpan` points so a tiny wobble
 * is not drawn as a cliff, and keep the range inside 0..100.
 */
export function lengthAxis(rates: number[], baseline: number, minSpan = 6): { lo: number; hi: number } {
  let lo = Math.min(baseline, ...rates) - 1, hi = Math.max(baseline, ...rates) + 1;
  if (hi - lo < minSpan) { const mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  if (lo < 0) { hi -= lo; lo = 0; }
  if (hi > 100) { lo -= hi - 100; hi = 100; }
  return { lo: Math.max(0, lo), hi: Math.min(100, hi) };
}

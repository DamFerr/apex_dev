/**
 * What an import to the League client tells the person, as at most one summary toast plus one error toast per failed step
 * (replaces the old on-screen import log, PLAN.md G.5). Pure, so the wording rules are testable.
 */
export type ImportStep = "runes" | "spells" | "items";
export interface ImportOutcome {
  step: ImportStep;
  /** What was written, e.g. "rune page", "spells Flash + Ignite", "2 item sets". */
  done?: string;
  /** Nothing written because there is not enough data yet (not an error). */
  skipped?: boolean;
  /** Written from class-based defaults, not from collected games: an estimate, and the toast says so. */
  defaults?: boolean;
  error?: string;
}
const LABEL: Record<ImportStep, string> = { runes: "runes", spells: "spells", items: "item sets" };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");

export function summarizeImport(outcomes: ImportOutcome[]): { message: string | null; errors: string[] } {
  const done = outcomes.filter((o) => o.done), skipped = outcomes.filter((o) => o.skipped).map((o) => LABEL[o.step]);
  const defaults = done.filter((o) => o.defaults).map((o) => LABEL[o.step]);
  const notes = [defaults.length ? `defaults used for ${list(defaults)} (not enough collected games)` : "", skipped.length ? `${list(skipped)} skipped (not enough games)` : ""].filter(Boolean);
  const head = done.length ? `Imported ${list(done.map((o) => o.done!))}` : skipped.length ? "Nothing imported" : "";
  return {
    message: head ? [head, ...notes].join(" · ") : null,
    errors: outcomes.filter((o) => o.error).map((o) => `${cap(LABEL[o.step])} import failed: ${o.error}`),
  };
}

/** True when at least one step actually wrote something (not skipped, not failed): the setup page then shows "Imported". */
export const wroteAnything = (outcomes: readonly ImportOutcome[]): boolean => outcomes.some((o) => !!o.done);

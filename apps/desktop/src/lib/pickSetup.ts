import type { ChampionBuild, SpellPairStat } from "@apex/schema";
import type { ImportStep } from "./importSummary";
import { DEFAULT_VARIANT_SORT, pageBuild, spellPairsOf, type PageCore } from "@apex/lcu-core";

/**
 * What you picked on the setup page, as indexes into the lists the page shows (same order as the champion page):
 * `variantId` = build type (AP / AD / Tank ...), `runePage` = n-th rune page of that build, `spellPair` = n-th spell pair.
 * Anything missing or out of range falls back to the default, so a stale choice (another champion, new patch) can never break an import.
 */
export interface PickSetup { variantId?: string; runePage?: number; spellPair?: number }
export type RuneStat = PageCore["runePages"][number];
export interface ResolvedSetup {
  /** The build type in use (null = the champion has no variants). */
  variantId: string | null; core: PageCore | null;
  /** null = write class-based defaults (rune page) or role defaults (spells): no choice made and not enough collected games. */
  rune: RuneStat | null; spell: SpellPairStat | null;
}
const at = <T,>(list: readonly T[], i: number | undefined): T | undefined => (i !== undefined && Number.isInteger(i) && i >= 0 && i < list.length ? list[i] : undefined);

/**
 * The rune page and spell pair an import writes. The default is the top one of the best build type, and only if it has `minGames` collected games
 * (below that Apex says so and uses its defaults). An explicit choice is always honoured, even a small sample: you saw the games count on the page.
 */
export function resolveSetup(build: ChampionBuild | null, sel: PickSetup = {}, minGames = 10): ResolvedSetup {
  if (!build) return { variantId: null, core: null, rune: null, spell: null };
  const { core, variant } = pageBuild(build, DEFAULT_VARIANT_SORT, sel.variantId), pairs = spellPairsOf(core);
  const top = core.runePages[0], topPair = pairs[0];
  return {
    variantId: variant?.id ?? null, core,
    rune: at(core.runePages, sel.runePage) ?? (top && top.games >= minGames ? top : null),
    spell: at(pairs, sel.spellPair) ?? (topPair && topPair.games >= minGames ? topPair : null),
  };
}

/**
 * Which parts of the import a change of choice touches, so a click writes only that (a rune click never rewrites spells or item sets).
 * A new build type changes both the rune page and the spell pair. The item sets never depend on the choice (every build type is written).
 */
export function changedSteps(prev: PickSetup, next: PickSetup): ImportStep[] {
  const variant = prev.variantId !== next.variantId, steps: ImportStep[] = [];
  if (variant || prev.runePage !== next.runePage) steps.push("runes");
  if (variant || prev.spellPair !== next.spellPair) steps.push("spells");
  return steps;
}

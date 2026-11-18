import type { RiotParticipant } from "./riot";

/**
 * Item ids held in a participant's EXTRA item fields: anything that is not item0..item6 but looks like an item slot (item7, item8 ...,
 * roleBoundItem, roleQuestItem ...). Season 2026 moved the bot lane's boots to a dedicated 7th slot (the role quest slot), and the support quest
 * item has its own slot too; Apex was reading item0..item6 only, so an ADC's boots were missing from the stored final inventory. Reading every
 * numeric field named like `item<N>` (N above 6) or `roleBound...` / `roleQuest...` keeps working whatever Riot calls the field. Pure.
 */
const EXTRA = /^(item(\d+)|rolebound\w*|rolequest\w*)$/i;
export function extraItemFields(p: RiotParticipant): { field: string; id: number }[] {
  const out: { field: string; id: number }[] = [];
  for (const [field, v] of Object.entries(p as unknown as Record<string, unknown>)) {
    const m = EXTRA.exec(field); if (!m) continue;
    if (m[2] !== undefined && Number(m[2]) <= 6) continue;            // item0..item6 are read by name
    if (typeof v === "number" && v > 0) out.push({ field, id: v });
  }
  return out;
}
export const extraItems = (p: RiotParticipant): number[] => extraItemFields(p).map((x) => x.id);

let warned = false;
/** Says once per run which extra item fields real matches carry, so a wrong guess about a field name is visible in the log. */
export function noteExtraFields(p: RiotParticipant, log: (m: string) => void = console.warn): void {
  if (warned) return;
  const f = extraItemFields(p); if (!f.length) return;
  warned = true; log(`Apex: matches carry extra item fields (${f.map((x) => `${x.field}=${x.id}`).join(", ")}); they are stored as items.`);
}
export const resetNoteForTests = () => { warned = false; };

import { invoke } from "@tauri-apps/api/core";
import { planAction, type LcuRequest, type Step } from "@apex/lcu-core";
import { serial } from "./importer";
import { champName, useDraft } from "./lcu";
import { toast } from "./toast";

let busy = false;
const send = (r: LcuRequest) => invoke("lcu_request", { method: r.method, path: r.path, body: r.body });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Waits (up to `ms`) for the League client's own update to show that `done(draft)` is true. */
async function seen(done: () => boolean, ms = 1500) { for (let t = 0; t < ms; t += 100) { if (done()) return true; await wait(100); } return done(); }

/**
 * ONE user click = one champ select action in the real League client, on YOUR own action only. Never called automatically.
 *  hover: shows the champion in your slot. commit: finishes the action (lock in a pick, or ban).
 * The plan is made from the latest draft state at click time and refuses off-turn or taken champions. A commit is checked
 * against the client's own update afterwards: if the action is still open, the fallback request is tried once, and if it
 * is STILL open you get an error instead of a success message (so a commit that only hovered is never reported as done).
 */
export async function actInChampSelect(kind: "pick" | "ban", step: Step, championKey: number): Promise<boolean> {
  if (busy) return false;
  const { draft, clickActions } = useDraft.getState();
  if (!clickActions) return false;
  const plan = planAction(draft, kind, step, championKey);
  if (!plan.ok) { toast(plan.reason, "error"); return false; }
  const open = () => useDraft.getState().draft.myActions[kind] === plan.id;   // true while this action is still waiting
  const name = champName(championKey), verb = kind === "ban" ? "Ban" : "Lock in";
  busy = true;
  try {
    await serial(() => send(plan.request));
    if (step === "hover") { toast(`Hovering ${name}`); return true; }
    if (await seen(() => !open())) { toast(`${kind === "ban" ? "Banned" : "Locked in"} ${name}`); return true; }
    if (plan.fallback) { await serial(() => send(plan.fallback!)); if (await seen(() => !open())) { toast(`${kind === "ban" ? "Banned" : "Locked in"} ${name}`); return true; } }
    toast(`${name} is hovered, but the League client did not accept the ${verb.toLowerCase()}. Press ${verb} in the client.`, "error");
    return false;
  } catch (e) {
    toast(`${verb === "Ban" && step === "commit" ? "Ban" : step === "commit" ? "Lock in" : "Hover"} failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    return false;
  } finally { busy = false; }
}

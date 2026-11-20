import { describe, expect, it } from "vitest";
import { buildSession, initialDraft, planAction, reduce, takenChampions } from "./index";

const st = (sim: Partial<Parameters<typeof buildSession>[0]> = {}) => reduce(initialDraft, { type: "session", session: buildSession({ bans: [[], []], hover: {}, locked: {}, ...sim }) });
const A = "/lol-champ-select/v1/session/actions";

describe("draft state: your own actions", () => {
  it("has none when you have no turn", () => expect(st().myActions).toEqual({ pick: null, pickLive: false, ban: null }));
  it("your pick turn: pick action live", () => expect(st({ pickTurn: 2 }).myActions).toEqual({ pick: 98, pickLive: true, ban: null }));
  it("ban phase: your ban is live and your pick exists but is not live yet", () => expect(st({ banTurn: 2, pickWaiting: 2 }).myActions).toEqual({ pick: 97, pickLive: false, ban: 99 }));
  it("someone else's turn is not yours", () => expect(st({ pickTurn: 3 }).myActions).toEqual({ pick: null, pickLive: false, ban: null }));
});

describe("ban phase only", () => {
  const inPhase = (phase: string, sim: Parameters<typeof buildSession>[0]) => { const b = buildSession(sim); return reduce(initialDraft, { type: "session", session: { ...b, timer: { ...b.timer, phase } } }); };
  const sim = { bans: [[], []] as number[][], hover: {}, locked: {}, banTurn: 2, pickWaiting: 2 };
  it("planning (hover your champion): an unfinished ban is not live, so no ban suggestions or buttons", () => {
    const d = inPhase("PLANNING", sim);
    expect(d.banning).toBe(false); expect(d.myActions.ban).toBeNull();
    expect(d.myActions.pick).toBe(97); // hovering your pick still works
    expect(planAction(d, "ban", "hover", 103)).toMatchObject({ ok: false });
  });
  it("ban phase: live", () => { const d = inPhase("BAN_PICK", sim); expect(d.banning).toBe(true); expect(d.myActions.ban).toBe(99); });
  it("after the bans (finalization): a leftover ban action is not live", () => { const d = inPhase("FINALIZATION", sim); expect(d.banning).toBe(false); expect(d.myActions.ban).toBeNull(); });
});

describe("planAction: the phases", () => {
  it("pre-ban / ban phase: hover your pick, but you cannot lock it in yet", () => {
    const d = st({ pickWaiting: 2 });
    expect(planAction(d, "pick", "hover", 103)).toEqual({ ok: true, id: 97, request: { method: "PATCH", path: `${A}/97`, body: { championId: 103 } } });
    expect(planAction(d, "pick", "commit", 103)).toMatchObject({ ok: false });
  });
  it("your ban turn: hover a ban and really ban (PATCH completed, POST complete as the fallback)", () => {
    const d = st({ banTurn: 2, pickWaiting: 2 });
    expect(planAction(d, "ban", "hover", 266)).toMatchObject({ ok: true, request: { path: `${A}/99`, body: { championId: 266 } } });
    expect(planAction(d, "ban", "commit", 266)).toEqual({ ok: true, id: 99, request: { method: "PATCH", path: `${A}/99`, body: { championId: 266, completed: true } }, fallback: { method: "POST", path: `${A}/99/complete` } });
  });
  it("after the bans, on your pick turn: really lock in", () => {
    expect(planAction(st({ pickTurn: 2 }), "pick", "commit", 103)).toEqual({ ok: true, id: 98, request: { method: "PATCH", path: `${A}/98`, body: { championId: 103, completed: true } }, fallback: { method: "POST", path: `${A}/98/complete` } });
  });
  it("a hover never completes", () => expect(planAction(st({ pickTurn: 2 }), "pick", "hover", 103)).toMatchObject({ ok: true, request: { body: { championId: 103 } } }));
});

describe("planAction: refusals", () => {
  it("not your ban turn, nothing to pick, outside champ select", () => {
    expect(planAction(st({ pickTurn: 2 }), "ban", "commit", 103)).toMatchObject({ ok: false });
    expect(planAction(st({ locked: { 2: 55 } }), "pick", "hover", 103)).toMatchObject({ ok: false });
    expect(planAction(initialDraft, "pick", "hover", 103)).toMatchObject({ ok: false });
  });
  it("banned or already picked champions and bad ids", () => {
    expect(planAction(st({ pickTurn: 2, bans: [[103], []] }), "pick", "commit", 103)).toMatchObject({ ok: false });
    expect(planAction(st({ pickTurn: 2, locked: { 0: 103 } }), "pick", "hover", 103)).toMatchObject({ ok: false });
    expect(planAction(st({ pickTurn: 2 }), "pick", "hover", 0)).toMatchObject({ ok: false });
    expect(planAction(st({ pickTurn: 2 }), "pick", "hover", 1.5)).toMatchObject({ ok: false });
  });
  it("takenChampions = locked picks and bans of both teams, not hovers", () => {
    expect([...takenChampions(st({ bans: [[1], [2]], locked: { 0: 3 }, hover: { 1: 4 } }))].sort()).toEqual([1, 2, 3]);
  });
});

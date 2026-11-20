import { describe, expect, it } from "vitest";
import { toMatchDetail } from "./mapping";
import { matchFixture, participant } from "./testkit";

describe("toMatchDetail: riotId (links to profiles)", () => {
  it("is Name#TAG when Riot reports both parts, and absent otherwise (name only, hidden or old games)", () => {
    const ps = [participant(0, { riotIdGameName: "Faker", riotIdTagline: "KR1" }), participant(1, { riotIdGameName: "NoTag" }), participant(2, { riotIdGameName: "", riotIdTagline: "EUW" }),
      ...Array.from({ length: 7 }, (_, i) => participant(i + 3))];
    const d = toMatchDetail(matchFixture("EUW1_1", { participants: ps }), "p0");
    expect(d.participants[0]!.riotId).toBe("Faker#KR1");
    expect("riotId" in d.participants[1]!).toBe(false);
    expect("riotId" in d.participants[2]!).toBe(false);
  });
  it("keeps the full Riot ID even when two players share a display name (the shown name gets a suffix, the ID does not)", () => {
    const ps = [participant(0, { riotIdGameName: "Dup", riotIdTagline: "A" }), participant(1, { riotIdGameName: "Dup", riotIdTagline: "B" }), ...Array.from({ length: 8 }, (_, i) => participant(i + 2))];
    const d = toMatchDetail(matchFixture("EUW1_2", { participants: ps }), "p0");
    expect(d.participants[0]!.riotId).toBe("Dup#A"); expect(d.participants[1]!.riotId).toBe("Dup#B"); expect(d.participants[1]!.name).toBe("Dup (2)");
  });
});

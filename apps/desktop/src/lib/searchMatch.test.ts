import { describe, expect, it } from "vitest";
import { matchRank, normalizeSearch, searchChampions } from "./searchMatch";

const L = [
  { id: "Kaisa", name: "Kai'Sa" }, { id: "MonkeyKing", name: "Wukong" }, { id: "DrMundo", name: "Dr. Mundo" },
  { id: "Velkoz", name: "Vel'Koz" }, { id: "Nunu", name: "Nunu & Willump" }, { id: "KSante", name: "K'Sante" },
  { id: "Ahri", name: "Ahri" }, { id: "Akali", name: "Akali" }, { id: "Aatrox", name: "Aatrox" },
  { id: "Renata", name: "Renata Glasc" }, { id: "Belveth", name: "Bel'Veth" }, { id: "Leblanc", name: "LeBlanc" },
];
const names = (q: string, limit?: number) => searchChampions(L, q, limit).map((c) => c.name);

describe("normalizeSearch", () => {
  it("ignores case, spaces, apostrophes (straight and curly), dots and ampersands", () => {
    expect(normalizeSearch("Kai'Sa")).toBe("kaisa");
    expect(normalizeSearch("Kai\u2019Sa")).toBe("kaisa");
    expect(normalizeSearch("  Dr. Mundo ")).toBe("drmundo");
    expect(normalizeSearch("Nunu & Willump")).toBe("nunuwillump");
  });
  it("strips accents and returns empty for punctuation only", () => {
    expect(normalizeSearch("Ahrí")).toBe("ahri");
    expect(normalizeSearch(" '. ")).toBe("");
  });
});

describe("searchChampions", () => {
  it("finds Kai'Sa as kaisa, KAISA, kai sa and kai'sa", () => {
    for (const q of ["kaisa", "KAISA", "kai sa", "kai'sa", "Kai\u2019Sa"]) expect(names(q)).toEqual(["Kai'Sa"]);
  });
  it("finds Wukong by display name and by its internal id", () => {
    expect(names("wukong")).toEqual(["Wukong"]);
    expect(names("monkey")).toEqual(["Wukong"]);
  });
  it("matches punctuated names without the punctuation", () => {
    expect(names("drmundo")).toEqual(["Dr. Mundo"]);
    expect(names("velkoz")).toEqual(["Vel'Koz"]);
    expect(names("ksante")).toEqual(["K'Sante"]);
    expect(names("belveth")).toEqual(["Bel'Veth"]);
  });
  it("matches the start of a later word", () => {
    expect(names("willump")).toEqual(["Nunu & Willump"]);
    expect(names("glasc")).toEqual(["Renata Glasc"]);
  });
  it("ranks exact, then prefix, then word start, then substring; ties alphabetical", () => {
    expect(names("a", 20).slice(0, 3)).toEqual(["Aatrox", "Ahri", "Akali"]);
    expect(names("ahri")[0]).toBe("Ahri");
    expect(matchRank("ahri", L[6])).toBe(0);
    expect(matchRank("ah", L[6])).toBe(1);
    expect(matchRank("willump", L[4])).toBe(2);
    expect(matchRank("ais", L[0])).toBe(3);
    expect(matchRank("zzz", L[0])).toBeNull();
  });
  it("returns [] for an empty or punctuation-only query", () => {
    expect(names("")).toEqual([]);
    expect(names("   ")).toEqual([]);
    expect(names("'")).toEqual([]);
  });
  it("respects the limit and does not mutate the input", () => {
    const copy = [...L];
    expect(names("a", 2)).toHaveLength(2);
    expect(names("a", 0)).toEqual([]);
    expect(L).toEqual(copy);
  });
});

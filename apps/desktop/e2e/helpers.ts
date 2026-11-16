import { expect, type Page } from "@playwright/test";

const CHAMPS: [number, string, string][] = [[103, "Ahri", "Mage"], [61, "Orianna", "Mage"], [112, "Viktor", "Mage"], [134, "Syndra", "Mage"], [81, "Ezreal", "Marksman"],
  [222, "Jinx", "Marksman"], [22, "Ashe", "Marksman"], [64, "LeeSin", "Fighter"], [121, "Khazix", "Assassin"], [412, "Thresh", "Support"], [89, "Leona", "Tank"],
  [117, "Lulu", "Support"], [86, "Garen", "Fighter"], [516, "Ornn", "Tank"], [122, "Darius", "Fighter"], [99, "Lux", "Mage"], [157, "Yasuo", "Fighter"],
  [238, "Zed", "Assassin"], [893, "Aurora", "Mage"]];
export const CHAMP_COUNT = CHAMPS.length;

/** Fakes Riot's Data Dragon so tests never depend on the internet. Call BEFORE page.goto. Icons 404 and fall back to initials. */
export async function fakeDataDragon(page: Page) {
  // Display names differ from ids for some champions ("LeeSin" is "Lee Sin"), like the real Data Dragon.
  const NAMES: Record<string, string> = { LeeSin: "Lee Sin", Khazix: "Kha'Zix" };
  const data = Object.fromEntries(CHAMPS.map(([key, id, tag]) => [id, { id, key: String(key), name: NAMES[id] ?? id, tags: [tag] }]));
  await page.route("https://ddragon.leagueoflegends.com/**", (r) => {
    const u = r.request().url();
    if (u.endsWith("versions.json")) return r.fulfill({ json: ["16.22.1"] });
    if (u.endsWith("champion.json")) return r.fulfill({ json: { data } });
    if (u.includes("runesReforged")) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, body: "" });
  });
}

/** Content counts as visible when <main> has text and its animated wrapper is fully opaque (the old blank-page bug left it at 0). */
export async function expectContentVisible(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const m = document.querySelector("main"), w = m?.firstElementChild;
    return !!w && (m!.textContent ?? "").trim().length > 10 && parseFloat(getComputedStyle(w).opacity) > 0.99;
  }), { timeout: 5000 }).toBe(true);
}

/** Fails the test on uncaught page errors (React errors, hook-order bugs, etc.). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/**
 * Points the app at the fake-Riot test API (services/api/src/fake-server.ts, port 8788) and fakes Data Dragon. Call BEFORE page.goto.
 * Settings are only written on the first load, so a reload keeps whatever the app saved (filters, theme, ...).
 */
export async function useFakeBackend(page: Page, o: { url?: string; riotId?: string } = {}) {
  await fakeDataDragon(page);
  const url = o.url ?? "http://127.0.0.1:8788", riotId = o.riotId ?? "Test Player#EUW";
  await page.addInitScript(([u, id]) => { if (!localStorage.getItem("apex-ui")) localStorage.setItem("apex-ui", JSON.stringify({ state: { backendUrl: u, myRiotId: id }, version: 1 })); }, [url, riotId]);
}

import { expect, test } from "./helpers";


test("search validates Riot IDs and opens a profile", async ({ page }) => {
  await page.goto("/#/");
  const box = page.getByLabel("Riot ID", { exact: true });
  await box.fill("nohashtag"); await box.press("Enter");
  await expect(page.getByText("Enter a Riot ID like Name#TAG")).toBeVisible();
  await box.fill("Test Player#EUW"); await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Test Player#EUW" })).toBeVisible();
  await expect(page.getByText("Emerald II")).toBeVisible();
});

test("match history loads more on scroll, filters, and expands a match", async ({ page }) => {
  await page.goto("/#/profile");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  const main = page.locator("main");
  await expect(async () => { await main.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await expect(page.getByText("End of history")).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 20_000 });
  await expect(page.getByText("25 games loaded")).toBeVisible();
  const rows = page.locator("li button[aria-expanded]");
  await page.getByRole("button", { name: "Losses" }).click();
  await expect(rows).toHaveCount(0);                         // the test player wins every game
  await page.getByRole("button", { name: "Wins" }).click();
  await expect(rows).toHaveCount(25);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.locator("tr.text-gold")).toHaveCount(1); // you are marked in the scoreboard
  await expect(page.getByText(/Victory|Defeat/).first()).toBeVisible();
});

test("mastery tab works, and switching tabs brings the match list back", async ({ page }) => {
  await page.goto("/#/profile");
  await page.getByRole("tab", { name: "Mastery" }).click();
  await expect(page.getByText("M10")).toBeVisible();
  await page.getByRole("tab", { name: "Match history" }).click();
  await expect(page.getByText(/games loaded/)).toBeVisible(); // infinite scroll area comes back after switching tabs
});

test("an unknown player shows a clear error", async ({ page }) => {
  await page.goto("/#/profile/Nobody%23EUW");
  await expect(page.getByText("Not found on Riot's servers")).toBeVisible();
});

test("LP history shows the chart, the promotion and honest totals", async ({ page }) => {
  await page.goto("/#/profile");
  await page.getByRole("tab", { name: "LP history" }).click();
  await expect(page.getByRole("img", { name: /LP history, 5 checks/ })).toBeVisible();
  await expect(page.getByText("Emerald II · 64 LP").first()).toBeVisible();
  await expect(page.getByText("+284 LP")).toBeVisible();              // Platinum I 80 LP -> Emerald II 64 LP
  await expect(page.getByText("46 games (27W 19L)")).toBeVisible();
  await expect(page.getByText("Promoted")).toHaveCount(3);             // Platinum I -> Emerald IV -> III -> II
  await expect(page.getByText(/not one game/)).toBeVisible();
});

test.describe("a player Apex has not seen before", () => {
  test("LP history starts with a single point and says so", async ({ page }) => {
    await page.goto("/#/profile/Fresh%20Player%23EUW");
    await page.getByRole("tab", { name: "LP history" }).click();
    await expect(page.getByText("No change yet")).toBeVisible();
    await expect(page.getByText(/Apex started tracking on/)).toBeVisible();
  });
});


test("a champion id in Riot's spelling (FiddleSticks) still shows the right name and loads the right icon file", async ({ page }) => {
  await page.route("**/v1/matches/**", (r) => r.fulfill({ json: { id: "EUW1_1", blueWon: true, participants: [{ name: "Fid", loadout: { items: [], trinket: null, spells: [], keystone: null, secondaryStyle: null },
    champion: "FiddleSticks", team: "blue", kills: 1, deaths: 1, assists: 1, cs: 1, damage: 1, gold: 1, vision: 1 }] } }));
  const icon = page.waitForRequest(/\/img\/champion\/Fiddlesticks\.png$/);
  await page.goto("/#/profile");
  await page.locator("li button[aria-expanded]").first().click();
  await expect(page.getByText("Fiddlesticks", { exact: true })).toBeVisible();
  await icon;                                                               // never .../FiddleSticks.png, which does not exist on Data Dragon
});

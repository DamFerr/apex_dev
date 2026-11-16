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

test("mastery tab works, and the LP history tab is gone", async ({ page }) => {
  await page.goto("/#/profile");
  await page.getByRole("tab", { name: "Mastery" }).click();
  await expect(page.getByText("M10")).toBeVisible();
  await expect(page.getByRole("tab", { name: "LP history" })).toHaveCount(0);
  await page.getByRole("tab", { name: "Match history" }).click();
  await expect(page.getByText(/games loaded/)).toBeVisible(); // infinite scroll area comes back after switching tabs
});

test("an unknown player shows a clear error", async ({ page }) => {
  await page.goto("/#/profile/Nobody%23EUW");
  await expect(page.getByText("Not found on Riot's servers")).toBeVisible();
});

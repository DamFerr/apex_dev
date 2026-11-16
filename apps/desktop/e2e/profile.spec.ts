import { expect, test } from "@playwright/test";
import { useFakeBackend } from "./helpers";

test("search validates Riot IDs and opens a profile", async ({ page }) => {
  await useFakeBackend(page); await page.goto("/#/");
  const box = page.getByLabel("Riot ID");
  await box.fill("nohashtag"); await box.press("Enter");
  await expect(page.getByText("Enter a Riot ID like Name#TAG")).toBeVisible();
  await box.fill("Test Player#EUW"); await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Test Player#EUW" })).toBeVisible();
  await expect(page.getByText("Emerald II")).toBeVisible();
});

test("without a Riot ID, Home and Profile ask for one instead of showing a demo player", async ({ page }) => {
  await useFakeBackend(page, { riotId: "" }); await page.goto("/#/");
  await expect(page.getByText("Set your Riot ID to see your games.")).toBeVisible();
  await page.goto("/#/profile");
  await expect(page.getByText("Set your Riot ID to see your profile.")).toBeVisible();
});

test("match history loads more on scroll, filters, and expands a match with proper champion names", async ({ page }) => {
  await useFakeBackend(page); await page.goto("/#/profile");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  const main = page.locator("main");
  await expect(async () => { await main.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await expect(page.getByText("End of history")).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 20_000 });
  await expect(page.getByText("25 games loaded")).toBeVisible();        // the fake Riot lists 25 games
  await page.getByRole("button", { name: "Losses" }).click();
  await expect(page.locator("li button[aria-expanded]")).toHaveCount(0); // every fake game is a win
  await page.getByRole("button", { name: "Wins" }).click();
  const first = page.locator("li button[aria-expanded]").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByText(/Victory|Defeat/).first()).toBeVisible();
  await expect(page.getByRole("table").first().getByText("Lee Sin")).toBeVisible();   // "LeeSin" is shown as "Lee Sin"
  await expect(page.getByText("LeeSin")).toHaveCount(0);
});

test("tabs: mastery, LP history explains itself, and the match list comes back", async ({ page }) => {
  await useFakeBackend(page); await page.goto("/#/profile");
  await page.getByRole("tab", { name: "Mastery" }).click();
  await expect(page.getByText(/^M\d+$/).first()).toBeVisible();
  await page.getByRole("tab", { name: "LP history" }).click();
  await expect(page.getByText(/needs the data collector/)).toBeVisible();
  await page.getByRole("tab", { name: "Match history" }).click();
  await expect(page.getByText(/games loaded/)).toBeVisible();
});

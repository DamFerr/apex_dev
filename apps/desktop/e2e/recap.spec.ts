import { expect, test } from "@playwright/test";
import { collectErrors, expectContentVisible, useFakeBackend } from "./helpers";

test.beforeEach(async ({ page }) => { await useFakeBackend(page); });

test("recap shows result, four metrics, grade and where the comparison comes from", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/recap");
  await expectContentVisible(page);
  await expect(page.getByText(/^(Victory|Defeat)$/)).toBeVisible();
  for (const label of ["KDA", "CS per minute", "Damage per minute", "Gold per minute"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await expect(page.getByText(/^Grade [SABCD]$/)).toBeVisible();
  await expect(page.getByText(/Rank comparison: Emerald Ahri Top \(Ranked Solo\), 40 collected games/)).toBeVisible();
  await expect(page.getByText(/Your comparison: 10 other recent games/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("Home links to the last game recap, and a profile match opens its own recap", async ({ page }) => {
  await page.goto("/#/");
  await page.getByRole("link", { name: /Last game recap/ }).click();
  await expect(page).toHaveURL(/#\/recap/);
  await page.goto("/#/profile");
  await page.locator("li button[aria-expanded]").first().click();
  await page.getByRole("link", { name: /Open full recap/ }).click();
  await expect(page).toHaveURL(/#\/recap\/.+\/EUW1_/);
  await expect(page.getByText(/^(Victory|Defeat)$/)).toBeVisible();
});

test("grade is exactly average for a game identical to every average, and unknown players get a clear error", async ({ page }) => {
  await page.goto("/#/recap");
  await expect(page.getByText("Grade B")).toBeVisible();                // identical to every average in the fixtures, so exactly 50/100
  await page.goto("/#/recap/Nobody%23EUW");
  await expect(page.getByRole("alert")).toContainText("Not found on Riot's servers");
});

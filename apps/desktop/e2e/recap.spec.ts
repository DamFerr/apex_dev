import { expect, test, collectErrors, expectContentVisible } from "./helpers";


test("recap shows the result, four metrics, a grade and where the comparison comes from", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/recap");
  await expectContentVisible(page);
  await expect(page.getByText("Victory")).toBeVisible();
  for (const label of ["KDA", "CS per minute", "Damage per minute", "Gold per minute"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await expect(page.getByText(/Rank comparison: Emerald Ahri Top \(Ranked Solo\), 40 collected games/)).toBeVisible();
  await expect(page.getByText(/Your comparison: 10 other recent games/)).toBeVisible();
  await expect(page.getByText("Grade B")).toBeVisible(); // identical to every average in the fixtures, so exactly 50/100
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

test("an unknown player gets a clear error", async ({ page }) => {
  await page.goto("/#/recap/Nobody%23EUW");
  await expect(page.getByRole("alert")).toContainText("Not found on Riot's servers");
});

test.describe("first run", () => {
  test.use({ opts: { riotId: "" } });
  test("without a saved Riot ID the recap asks for one", async ({ page }) => {
    await page.goto("/#/recap");
    await expect(page.getByText("Add your Riot ID")).toBeVisible();
  });
});

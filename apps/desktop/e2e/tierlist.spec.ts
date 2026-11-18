import { expect, test, collectErrors, expectContentVisible } from "./helpers";


// The grading maths is unit tested in packages/stats-core. The test backend only holds 40 games, which is below the
// "enough data" bar for every role, so this checks the honest empty state and the controls.
test("tier list explains when there is too little data, and switches role", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/tierlist");
  await expectContentVisible(page);
  await expect(page.getByRole("heading", { name: "Tier List" })).toBeVisible();
  await expect(page.getByText(/Not enough collected games for this role/)).toBeVisible();
  await page.getByRole("button", { name: "Support" }).click();
  await expect(page.getByRole("button", { name: "Support" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Not enough collected games for this role/)).toBeVisible();
  expect(errors).toEqual([]);
});

// Both patches exist in the test backend, but no champion has 50 games in the same role in both, so the view must say that instead of showing noise.
test("tier list has a patch changes view that is honest about too little data", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/tierlist");
  await expectContentVisible(page);
  await page.getByRole("tab", { name: "Patch changes" }).click();
  await expect(page.getByRole("tab", { name: "Patch changes" })).toHaveAttribute("aria-selected", "true");
  const view = page.getByLabel("Patch changes", { exact: true }).last();
  await expect(view).toContainText("26.22"); await expect(view).toContainText("26.21");
  await expect(view.getByText(/No champion has enough games in both patches/)).toBeVisible();
  await page.getByRole("tab", { name: "Tiers" }).click();
  await expect(page.getByText(/Not enough collected games for this role/)).toBeVisible();
  expect(errors).toEqual([]);
});

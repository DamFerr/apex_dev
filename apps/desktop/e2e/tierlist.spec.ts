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

import { expect, test, collectErrors, expectContentVisible } from "./helpers";

const ROUTES = ["/", "/draft", "/champions", "/tierlist", "/profile", "/live", "/recap", "/settings"];


test("every page renders its content", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/");
  for (const r of ROUTES) { await page.evaluate((h) => (location.hash = h), r); await expectContentVisible(page); }
  expect(errors).toEqual([]);
});

test("no screen shows test or sample-data wording", async ({ page }) => {
  await page.goto("/#/");
  for (const r of ROUTES) {
    await page.evaluate((h) => (location.hash = h), r); await expectContentVisible(page);
    expect(await page.locator("body").innerText(), r).not.toMatch(/mock|demo|synthetic|placeholder|coming soon/i);
  }
});

test("rapid page switching never leaves a blank page (regression)", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/");
  for (let round = 0; round < 4; round++) {
    for (const r of [...ROUTES].sort(() => Math.random() - 0.5)) { await page.evaluate((h) => (location.hash = h), r); await page.waitForTimeout(40); }
    await expectContentVisible(page);
  }
  expect(errors).toEqual([]);
});

test("unknown addresses go back to Home", async ({ page }) => {
  await page.goto("/#/analysis");
  await expect(page).toHaveURL(/#\/$/);
  await expectContentVisible(page);
});

test("command palette opens with Ctrl+K and navigates", async ({ page }) => {
  await page.goto("/#/");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.type("champ"); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/champions/);
  await expect(page.getByRole("dialog")).toBeHidden();
});

import { expect, test } from "@playwright/test";
import { collectErrors, expectContentVisible, useFakeBackend } from "./helpers";

const ROUTES = ["/", "/draft", "/champions", "/tierlist", "/profile", "/live", "/recap", "/analysis", "/pro", "/settings"];

test.beforeEach(async ({ page }) => { await useFakeBackend(page); });

test("every page renders its content", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/");
  for (const r of ROUTES) { await page.evaluate((h) => (location.hash = h), r); await expectContentVisible(page); }
  expect(errors).toEqual([]);
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

test("switching between 'coming soon' pages keeps hooks stable (regression)", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/pro");
  for (const r of ["/analysis", "/pro", "/analysis"]) { await page.evaluate((h) => (location.hash = h), r); await expectContentVisible(page); }
  expect(errors).toEqual([]);
});

test("command palette opens with Ctrl+K and navigates", async ({ page }) => {
  await page.goto("/#/");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.type("champ"); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/champions/);
  await expect(page.getByRole("dialog")).toBeHidden();
});

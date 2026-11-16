import { expect, test, type Page } from "@playwright/test";
import { collectErrors, useFakeBackend } from "./helpers";

/** Champ select runs against the mock League client (pnpm lcu-mock); the numbers come from the fake backend's 40 collected games. */
async function open(page: Page) {
  await useFakeBackend(page);
  await page.goto("/#/draft");
  await expect(page.getByText("League client (mock): connected")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Waiting for champ select…")).toBeVisible();
}

test("mock champ select: ban turn, suggestions from collected games, win probability, locks", async ({ page }) => {
  const errors = collectErrors(page);
  await open(page);
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  await expect(page.getByText("Your ban turn")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Ban suggestions" })).toContainText("40 collected games", { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Pick recommendations" })).toBeHidden(); // no pick suggestions during the ban turn
  await expect(page.getByRole("region", { name: "Pick recommendations" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Ban suggestions" })).toBeHidden();
  await expect(page.getByRole("region", { name: "Win probability" })).toContainText("Based on 40 collected games", { timeout: 40_000 });
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test("the pool checkbox is there and can be switched off without breaking the suggestions", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  const bans = page.getByRole("region", { name: "Ban suggestions" });
  await expect(bans).toContainText("40 collected games", { timeout: 20_000 });
  await page.getByLabel(/Use my champion pool \(your recent games\)/).uncheck();
  await expect(bans).toContainText("40 collected games");
});

test("with no collected games for the filters, Draft says so instead of inventing suggestions", async ({ page }) => {
  await open(page);
  await page.getByLabel("Region").selectOption("kr");                  // the fake backend has no Korean games
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  await expect(page.getByText(/No collected games for these filters yet/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Ban suggestions" })).toHaveCount(0);
});

test("dodge returns to the waiting state", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Start dodge scenario" }).click();
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Waiting for champ select…")).toBeVisible({ timeout: 30_000 });
});

test("auto-import is off by default and logs only when enabled", async ({ page }) => {
  await open(page);
  await expect(page.getByLabel(/Auto-import on lock-in/)).not.toBeChecked();
  await page.getByLabel(/Auto-import on lock-in/).check();
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  await expect(page.getByText(/Auto-import \(mock\)/)).toBeVisible({ timeout: 45_000 });
});

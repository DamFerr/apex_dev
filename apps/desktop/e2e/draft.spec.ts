import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test, collectErrors } from "./helpers";

/**
 * The League client simulator (packages/lcu-mock, started by the Playwright config) plays champ select. The app has no buttons for it:
 * these tests drive it over HTTP, the same way you would from a terminal. The browser build connects to it automatically.
 */
const SIM = "http://127.0.0.1:8765/scenario";
const play = (request: APIRequestContext, scenario: "normal" | "dodge" | "reset") => request.post(`${SIM}/${scenario}`);

async function open(page: Page, request: APIRequestContext) {
  await page.goto("/#/draft");
  await expect(page.getByText("League client: connected")).toBeVisible({ timeout: 15_000 });
  await play(request, "reset");
  await expect(page.getByText("Waiting for champ select…")).toBeVisible();
}

test("champ select: ban turn, win probability from collected games, suggestions, locks", async ({ page, request }) => {
  const errors = collectErrors(page);
  await open(page, request);
  await play(request, "normal");
  const bans = page.getByRole("region", { name: "Ban suggestions" });
  await expect(page.getByText("Your ban turn")).toBeVisible({ timeout: 15_000 });
  await expect(bans).toContainText("40 collected games");
  await expect(bans.locator("li").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Pick recommendations" })).toBeHidden(); // no pick suggestions during the ban turn
  await expect(page.getByRole("region", { name: "Pick recommendations" })).toBeVisible({ timeout: 20_000 });
  await expect(bans).toBeHidden();
  const bar = page.getByRole("region", { name: "Win probability" });
  await expect(bar).toContainText("Based on 40 collected games", { timeout: 40_000 });
  const before = await bar.innerText();
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => bar.innerText(), { timeout: 20_000 }).not.toBe(before); // the bar reacts as picks lock
  expect(errors).toEqual([]);
});

test("the champion-pool checkbox changes the ban reasons", async ({ page, request }) => {
  await open(page, request);
  await play(request, "normal");
  const bans = page.getByRole("region", { name: "Ban suggestions" });
  await expect(bans).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/Use my champion pool/).uncheck();
  await expect(bans).toContainText("Strong in general");
});

test("dodge returns to the waiting state", async ({ page, request }) => {
  await open(page, request);
  await play(request, "dodge");
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Waiting for champ select…")).toBeVisible({ timeout: 30_000 });
});

test("auto-import is off by default, and in the browser it only reports that it cannot write", async ({ page, request }) => {
  await open(page, request);
  await expect(page.getByLabel(/Auto-import on lock-in/)).not.toBeChecked();
  await page.getByLabel(/Auto-import on lock-in/).check();
  await play(request, "normal");
  await expect(page.getByText(/Import skipped for .* needs the desktop app/)).toBeVisible({ timeout: 45_000 });
});

test("the draft screen has no simulator controls", async ({ page, request }) => {
  await open(page, request);
  await expect(page.getByRole("button", { name: /mock|scenario/i })).toHaveCount(0);
});

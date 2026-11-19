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
  const picks = page.getByRole("region", { name: "Pick recommendations" });
  await expect(picks).toBeVisible(); // pick suggestions also show during the ban turn (you can hover your pick before and during the bans)
  await expect(bans).toBeHidden({ timeout: 20_000 }); // the ban suggestions go once the ban turn is over
  await expect(picks).toBeVisible();
  const bar = page.getByRole("region", { name: "Win probability" });
  await expect(bar).toContainText("Based on 40 collected games", { timeout: 40_000 });
  const before = await bar.innerText();
  await expect(page.getByText("LOCKED").first()).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => bar.innerText(), { timeout: 20_000 }).not.toBe(before); // the bar reacts as picks lock
  expect(errors).toEqual([]);
});

test("team composition appears once picks lock, and says when the split is only an estimate", async ({ page, request }) => {
  await open(page, request);
  await play(request, "normal");
  const comp = page.getByRole("region", { name: "Team composition" });
  await expect(comp).toBeVisible({ timeout: 45_000 });
  await expect(comp.getByRole("img", { name: /Your team: \d+% physical, \d+% magic/ })).toBeVisible();
  await expect(comp.getByRole("img", { name: /Enemy team: \d+% physical, \d+% magic/ })).toBeVisible();
  // The test backend's games carry no damage-type data, so the panel must not pretend to have measured anything.
  await expect(comp).toContainText("Estimated from champion classes");
  await expect(comp.getByRole("img", { name: /Damage taken|Crowd control time/ })).toHaveCount(0);
});

test("team composition is measured when collected games carry damage data", async ({ page, request }) => {
  // The test backend's games have no damage-type data, so add a profile for every champion it knows to the draft data response.
  await page.route("**/v1/draft/data*", async (route) => {
    const res = await route.fetch(), body = await res.json();
    body.profiles = body.champions.map((c: { id: string }, i: number) => ({ id: c.id, games: 50, phys: (i % 2 ? 9000 : 3000) * 50, magic: (i % 2 ? 3000 : 9000) * 50, trueDmg: 500 * 50, taken: 20000 * 50, cc: 30 * 50, seconds: 1800 * 50 }));
    await route.fulfill({ response: res, json: body });
  });
  await open(page, request);
  await play(request, "normal");
  const comp = page.getByRole("region", { name: "Team composition" });
  await expect(comp).toBeVisible({ timeout: 45_000 });
  await expect(comp).toContainText("Measured from collected games", { timeout: 45_000 });
  await expect(comp.getByRole("img", { name: /Damage taken: your team \d+, enemy team \d+ \/min/ })).toBeVisible();
  await expect(comp.getByRole("img", { name: /Crowd control time: your team/ })).toBeVisible();
  await expect(comp).not.toContainText("Estimated from champion classes");
  await comp.screenshot({ path: "test-results/team-composition.png" });
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

test("the Draft page opens by itself when champ select starts, once, and the setting turns it off", async ({ page, request }) => {
  await open(page, request);
  await page.goto("/#/champions");                                  // hash change only: the app and its LCU connection stay alive
  await play(request, "normal");
  await expect(page).toHaveURL(/#\/draft/, { timeout: 15_000 });
  await page.goto("/#/champions");                                  // leaving during the draft is respected: no second jump
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/#\/champions/);
  await play(request, "reset");
});

import { expect, test } from "@playwright/test";
import { useFakeBackend } from "./helpers";

/** Full stack: the real app -> the real local API (with a fake Riot behind it). Also proves the browser's CORS rules allow the app. */
const useBackend = useFakeBackend;

test("Home shows the real rank and games from the backend", async ({ page }) => {
  await useBackend(page); await page.goto("/#/");
  await expect(page.getByText("Emerald II")).toBeVisible();
  await expect(page.getByText("87W 79L")).toBeVisible();
  await expect(page.getByText("Ahri").first()).toBeVisible();
  await expect(page.getByText("Your recent games")).toBeVisible();
});

test("profile: unknown player shows a clear error", async ({ page }) => {
  await useBackend(page); await page.goto("/#/profile/Nobody%23EUW");
  await expect(page.getByText("Not found on Riot's servers")).toBeVisible();
});

test("profile: match detail marks you, mastery works, LP history explains itself", async ({ page }) => {
  await useBackend(page); await page.goto("/#/profile");
  const first = page.locator("li button[aria-expanded]").first();
  await first.click();
  await expect(page.locator("tr.text-gold")).toHaveCount(1);
  await page.getByRole("tab", { name: "Mastery" }).click();
  await expect(page.getByText("M10")).toBeVisible();
  await page.getByRole("tab", { name: "LP history" }).click();
  await expect(page.getByText(/needs the data collector/)).toBeVisible();
});

test("an unreachable backend explains how to fix it", async ({ page }) => {
  await useBackend(page, { url: "http://127.0.0.1:9" });
  await page.goto("/#/");
  await expect(page.getByText(/Local backend not reachable/).first()).toBeVisible({ timeout: 15_000 });
});

test("Settings can test the backend connection", async ({ page }) => {
  await useBackend(page); await page.goto("/#/settings");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Local backend is running and has an API key")).toBeVisible();
});

test("Champions page shows real collected statistics with their sample size", async ({ page }) => {
  await useBackend(page); await page.goto("/#/champions");
  await expect(page.getByText(/Collected data: 40 games, patch 16\.22/)).toBeVisible();
  const rows = page.locator("main tbody tr");
  await expect(rows).toHaveCount(10);                                   // the 10 champions in the collected games
  await expect(rows.filter({ hasText: "Ahri" })).toContainText("56.7%"); // 26 wins in 40 games, shrunk toward 50%
  await page.getByRole("button", { name: "Support" }).click();
  await expect(rows).toHaveCount(2);                                    // the two bottom-side supports (Thresh and Yasuo in the fixture)
});

test("champion page shows collected items, keystones and matchups", async ({ page }) => {
  await useBackend(page); await page.goto("/#/champions/Ahri");
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
  await expect(page.getByText("Zhonya's Hourglass")).toBeVisible();
  await expect(page.getByText("Press the Attack")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Lux" })).toBeVisible();
  await expect(page.getByText("Skill order")).toHaveCount(0);           // timelines are not collected yet
});

test("Settings shows the collector, which covers everything and can be paused and resumed", async ({ page }) => {
  await useBackend(page); await page.goto("/#/settings");
  await expect(page.getByText(/Paused · 60 games/)).toBeVisible();
  await expect(page.getByText(/ladders 0\/4/)).toBeVisible();
  await expect(page.getByRole("group", { name: "Collect regions" })).toHaveCount(0);   // no manual region/rank selection any more
  await page.getByRole("button", { name: "Resume collector" }).click();
  await expect(page.getByText(/Collecting · 60 games/)).toBeVisible();
  await page.getByRole("button", { name: "Pause collector" }).click();
  await expect(page.getByText(/Paused · 60 games/)).toBeVisible();
});

test("filters: region, patch and rank change the numbers, persist, and reset", async ({ page }) => {
  await useBackend(page); await page.goto("/#/champions");
  await expect(page.getByText(/Collected data: 40 games, patch 16\.22/)).toBeVisible();   // default: latest patch, all regions and ranks
  await page.getByLabel("Patch").selectOption("all");
  await expect(page.getByText(/Collected data: 60 games, all patches/)).toBeVisible();
  await page.getByLabel("Region").selectOption("na1");
  await expect(page.getByText(/Collected data: 20 games/)).toBeVisible();
  await page.getByLabel("Rank").selectOption("DIAMOND");                                    // Diamond and above
  await expect(page.getByText(/Collected data: 20 games/)).toBeVisible();
  await page.getByLabel("Rank").selectOption("EMERALD");                                    // Emerald means Emerald and above, so the Diamond games still count
  await expect(page.getByText(/Collected data: 20 games/)).toBeVisible();
  await page.getByLabel("Region").selectOption("all");
  await expect(page.getByText(/Collected data: 60 games/)).toBeVisible();                   // 40 Emerald + 20 Diamond are both "Emerald+"
  await page.getByLabel("Rank").selectOption("MASTER");
  await expect(page.getByText(/No collected games match these filters/)).toBeVisible();
  await page.getByLabel("Region").selectOption("euw1");
  await page.getByLabel("Rank").selectOption("DIAMOND");                                    // euw1 has only Emerald games
  await expect(page.getByText(/No collected games match these filters/)).toBeVisible();
  await page.getByLabel("Region").selectOption("na1");
  await page.reload();                                                                       // choices survive a restart
  await expect(page.getByLabel("Region")).toHaveValue("na1");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByText(/Collected data: 40 games, patch 16\.22/)).toBeVisible();
});

test("every region and rank is always offered, and ranks are cumulative", async ({ page }) => {
  await useBackend(page); await page.goto("/#/champions");
  await expect(page.getByLabel("Region").locator("option")).toHaveCount(18);                 // "all" + all 17 Riot regions
  await expect(page.getByLabel("Region").locator("option", { hasText: "Korea" })).toHaveText(/no data yet/);
  const ranks = await page.getByLabel("Rank").locator("option").allTextContents();
  expect(ranks[0]).toMatch(/All ranks \(Iron\+\)/);
  expect(ranks.some((r) => /^Emerald\+ · 60 games/.test(r))).toBe(true);                    // cumulative count: Emerald and above
  expect(ranks.some((r) => /^Diamond\+ · 20 games/.test(r))).toBe(true);
  expect(ranks.some((r) => /^Emerald( |$)/.test(r))).toBe(false);                            // there is no "exactly Emerald" option
});

test("searching a Riot ID finds the player in any region, without choosing one", async ({ page }) => {
  await useBackend(page); await page.goto("/#/");
  const box = page.getByLabel("Riot ID"); await box.fill("Na Player#NA1"); await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Na Player#NA1" })).toBeVisible();
  await expect(page.getByText(/Level 77 · NA1/)).toBeVisible();                              // found on North America automatically
});

test("Draft uses the collected statistics and offers the same filters", async ({ page }) => {
  await useBackend(page); await page.goto("/#/draft");
  await expect(page.getByLabel("Region")).toBeVisible();
  await expect(page.getByText("League client (mock): connected")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "Start mock champ select" }).click();
  await expect(page.getByRole("region", { name: "Ban suggestions" })).toContainText("40 collected games", { timeout: 20_000 });
  await expect(page.getByRole("region", { name: "Win probability" })).toContainText("Based on 40 collected games", { timeout: 40_000 });
  await expect(page.getByLabel(/Use my champion pool \(your recent games\)/)).toBeVisible();
});

test("filters apply to the champion page too, with a clear message when nothing matches", async ({ page }) => {
  await useBackend(page); await page.goto("/#/champions/Ahri");
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
  await page.getByLabel("Region").selectOption("na1");                                       // na1 games are on an older patch, and the default is the latest
  await expect(page.getByText(/No collected games for this champion with these filters/)).toBeVisible();
  await page.getByLabel("Patch").selectOption("all");
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
});

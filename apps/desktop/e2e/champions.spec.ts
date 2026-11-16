import { expect, test } from "@playwright/test";
import { useFakeBackend } from "./helpers";

test.beforeEach(async ({ page }) => { await useFakeBackend(page); });

test("lists the collected champions, filters by role, sorts and searches", async ({ page }) => {
  await page.goto("/#/champions");
  const rows = page.locator("main tbody tr");
  await expect(rows).toHaveCount(10);                                  // the 10 champions in the fake collected games
  await expect(page.getByLabel("Region")).toBeVisible();               // the filter bar always applies now
  await page.getByRole("button", { name: "Jungle" }).click();
  await expect(rows).toHaveCount(2);                                   // Jinx and Zed play jungle in the fixture
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(rows).toHaveCount(10);
  const header = page.locator("main thead").getByRole("button", { name: /^Champion/ });
  await header.click();                                                // first click: Z to A
  await expect(rows.first()).toContainText("Zed");
  await header.click();
  await expect(rows.first()).toContainText("Ahri");
  await page.getByLabel("Filter champions").fill("lee");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Lee Sin");                 // the display name, not the id "LeeSin"
});

test("opens a champion page with stats, builds and matchups", async ({ page }) => {
  await page.goto("/#/champions");
  await page.getByRole("link", { name: "Ahri" }).click();
  await expect(page).toHaveURL(/#\/champions\/Ahri/);
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
  await expect(page.getByText("Win rate (adjusted)").first()).toBeVisible();
  await expect(page.getByText("Matchups (best to worst)")).toBeVisible();
});

import { expect, test } from "./helpers";


// The test backend holds 40 collected games on the latest patch, with 10 champions in them (2 per role).
test("lists the collected champions, filters by role and sorts", async ({ page }) => {
  await page.goto("/#/champions");
  const rows = page.locator("main tbody tr");
  await expect(rows).toHaveCount(10);
  await page.getByRole("button", { name: "Jungle" }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(rows).toHaveCount(10);
  const header = page.locator("main thead").getByRole("button", { name: /^Champion/ });
  await header.click(); // first click: Z to A
  await expect(rows.first()).toContainText("Zed");
  await header.click();
  await expect(rows.first()).toContainText("Ahri");
  await page.getByLabel("Filter champions").fill("lee");
  await expect(rows).toHaveCount(1);
});

test("opens a champion page with stats, builds and matchups", async ({ page }) => {
  await page.goto("/#/champions");
  await page.getByRole("link", { name: "Ahri" }).click();
  await expect(page).toHaveURL(/#\/champions\/Ahri/);
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
  await expect(page.getByText("Win rate (adjusted)").first()).toBeVisible();
  await expect(page.getByText("Matchups (best to worst)")).toBeVisible();
  await expect(page.getByText("Skill order (max priority)")).toBeVisible();
});

test.describe("with the backend not running", () => {
  test.use({ opts: { url: "http://127.0.0.1:9" } });
  test("an unreachable backend shows a clear error instead of loading forever", async ({ page }) => {
    await page.goto("/#/champions");
    await expect(page.getByRole("alert")).toContainText(/Local backend not reachable/, { timeout: 15_000 });
  });
});

test("shows the recommended build (runes, spells, items) with sample sizes on the champion page", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Summoner spells:")).toContainText("Ignite + Flash");
  await expect(panel.getByText(/^Skill order ·/)).toBeVisible();
  await expect(panel.getByLabel("Max order Q then E then W")).toBeVisible();
  await expect(panel.getByText("First 9 levels: Q W E Q Q R Q E Q")).toBeVisible();
  await expect(panel.getByText(/^Starting items ·/)).toBeVisible();
  await expect(panel.getByText(/^Core items, usual build order ·/)).toBeVisible();
  await expect(panel.getByText(/collected games/).last()).toContainText("40");
});

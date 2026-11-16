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
});

test.describe("with the backend not running", () => {
  test.use({ opts: { url: "http://127.0.0.1:9" } });
  test("an unreachable backend shows a clear error instead of loading forever", async ({ page }) => {
    await page.goto("/#/champions");
    await expect(page.getByRole("alert")).toContainText(/Local backend not reachable/, { timeout: 15_000 });
  });
});

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
  await expect(page.getByRole("tab", { name: "Matchups" })).toBeVisible();
  await expect(page.getByText("Skill order (max priority)")).toHaveCount(0);   // the skill order is shown once, in the recommended build
  await expect(page.getByLabel("Recommended build").getByText(/^Skill order ·/)).toBeVisible();
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

test("shows matchups and synergy with sample sizes and the difference from expected", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Matchups and synergy");
  await expect(panel.getByRole("table", { name: /Lane matchups/ })).toBeVisible();
  const rows = panel.locator("tbody tr");
  await expect(rows).toHaveCount(1);                                      // Ahri plays TOP in the fixture, and Lux is the only top laner against her
  await expect(rows.first()).toContainText("Lux");
  await expect(rows.first()).toContainText("40");                         // games
  await expect(rows.first()).toContainText(/[+\u2212]\d+\.\d pp/);        // difference from expected, with its sign
  await panel.getByRole("tab", { name: "Synergy" }).click();
  await expect(panel.getByRole("table", { name: /Teammate synergy/ })).toBeVisible();
  await expect(rows).toHaveCount(4);                                      // jungle, mid, bot and support teammates
  await expect(panel.locator("tbody")).not.toContainText("Ahri");
  await expect(panel.getByRole("button", { name: /Show all/ })).toHaveCount(0);   // 4 rows: nothing to expand
  await panel.getByRole("button", { name: "Most played" }).click();
  await expect(panel.getByRole("button", { name: "Most played" })).toHaveAttribute("aria-pressed", "true");
});

test("a champion without enough pairings says so instead of showing an empty table", async ({ page }) => {
  await page.goto("/#/champions/Lux");
  const panel = page.getByLabel("Matchups and synergy");
  await expect(panel.getByRole("table")).toBeVisible();                   // Lux has the mirror data
  await page.route("**/v1/champions/Lux/relations**", (r) => r.fulfill({ json: { champion: "Lux", role: "TOP", base: { games: 40, wins: 14 }, matchups: [], synergies: [] } }));
  await page.reload();
  await expect(page.getByLabel("Matchups and synergy").getByText(/Not enough games yet/)).toBeVisible();
});

test("items show WPA (win probability added) with its explanation, on the champion page and in the build", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const items = page.getByRole("table").filter({ hasText: "Items" }).first();
  await expect(items.getByRole("columnheader", { name: "WPA" })).toBeVisible();
  await expect(items.getByText(/^[+−]\d+\.\d$/).first()).toBeVisible();                     // a signed number in percentage points
  await expect(page.getByText(/^WPA = win probability added/)).toBeVisible();
  const panel = page.getByLabel("Recommended build");
  await expect(panel.getByText(/Under each item: win rate, WPA/)).toBeVisible();
  await expect(panel.getByText(/^[+−]\d+\.\d$/).first()).toBeVisible();
});

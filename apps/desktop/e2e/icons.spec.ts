import { expect, test, collectErrors } from "./helpers";

/** Icons must always have an accessible name, and screens must still work when Data Dragon images (or all of Data Dragon) are unavailable. */
const unnamedImages = (page: import("@playwright/test").Page) => page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => !i.alt.trim()).length);

test("build panel icons (items, spells, skills, shards) all carry names", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build");
  await expect(panel.getByRole("group", { name: "Summoner spells Ignite + Flash" })).toBeVisible();
  await expect(panel.getByRole("img", { name: "Ignite" })).toBeVisible();
  await expect(panel.getByRole("img", { name: "Flash" })).toBeVisible();
  await expect(panel.getByRole("img", { name: "Zhonya's Hourglass" }).first()).toBeVisible();
  await expect(panel.getByRole("img", { name: "Q: Ahri Q" }).first()).toBeVisible();          // ability icons: key + ability name
  await expect(panel.getByRole("group", { name: "Stat shards" }).getByRole("img")).toHaveCount(9);   // 3 rows of 3 options, one chosen per row
  expect(await unnamedImages(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("the skill grid names every lit cell and the max order icons carry their key letter", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build");
  await expect(panel.getByLabel("Max order Q then E then W").locator("span[aria-hidden]").filter({ hasText: /^[QWE]$/ })).toHaveCount(3);
  await expect(panel.getByRole("table", { name: "Skill order by level" }).getByLabel(/^Level \d+: [QWER]$/)).toHaveCount(18);
});

test("everything still works, with names instead of pictures, when Data Dragon is completely offline", async ({ page }) => {
  const errors = collectErrors(page);
  await page.route("https://ddragon.leagueoflegends.com/**", (r) => r.abort());       // registered last, so it wins over the fake
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("group", { name: "Summoner spells Ignite + Flash" })).toBeVisible();
  await expect(panel.getByRole("img", { name: "Zhonya's Hourglass" }).first()).toBeVisible();
  await expect(panel.getByLabel("Max order Q then E then W")).toBeVisible();
  expect(await unnamedImages(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("role icons: tier list chips keep their names, match rows get a named role glyph", async ({ page }) => {
  await page.goto("/#/tierlist");
  await expect(page.getByRole("button", { name: "Support" })).toBeVisible();
  await page.goto("/#/profile");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  await expect(page.locator("li button[aria-expanded]").first().getByRole("img", { name: /^(Top|Jungle|Mid|ADC|Support)$/ })).toBeVisible();
});

test("an expanded match shows every player's spells, runes and items as named icons", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/profile");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  await page.locator("li button[aria-expanded]").first().click();
  const boards = page.getByRole("group", { name: "Loadout" });
  await expect(boards).toHaveCount(10);
  const first = boards.first();
  await expect(first.getByRole("img", { name: "Flash" })).toBeVisible();
  await expect(first.getByRole("img", { name: "Zhonya's Hourglass" }).first()).toBeVisible();
  await expect(first.getByRole("img", { name: "Stealth Ward" })).toBeVisible();     // the trinket
  expect(await unnamedImages(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("the post-game recap shows your own loadout", async ({ page }) => {
  await page.goto("/#/recap");
  const load = page.getByRole("group", { name: "Loadout" });
  await expect(load).toBeVisible();
  await expect(load.getByRole("img", { name: "Ignite" })).toBeVisible();
  await expect(load.getByRole("img", { name: "Lich Bane" })).toBeVisible();
});

test("champion page lists show item, keystone and matchup icons and the skill order as ability icons", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/champions/Ahri");
  const items = page.getByRole("table").filter({ hasText: "Items" }).first();
  await expect(items.getByRole("img", { name: "Zhonya's Hourglass" })).toBeVisible();
  await expect(items.getByText("Zhonya's Hourglass")).toBeVisible();                   // the name stays as text next to the icon
  const panel = page.getByLabel("Recommended build");
  await expect(panel.getByLabel("Max order Q then E then W").getByRole("img", { name: "Q: Ahri Q" })).toBeVisible();
  await expect(panel.getByText("First 9 levels: Q W E Q Q R Q E Q")).toBeAttached();   // text kept for screen readers
  await expect(panel.locator('[aria-label="R: Ahri R"]').first()).toBeAttached();   // drawn, but hidden from screen readers (the text above says the same)
  expect(await unnamedImages(page)).toBe(0);
  expect(errors).toEqual([]);
});

test("rank emblems (our own drawings) appear on Home and Profile next to the written rank", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.getByText("Emerald II")).toBeVisible();
  await expect(page.locator('svg[data-tier="EMERALD"]').first()).toBeVisible();
  await page.goto("/#/profile");
  await expect(page.getByText("Emerald II")).toBeVisible();
  await expect(page.locator('svg[data-tier="EMERALD"]').first()).toBeVisible();
});

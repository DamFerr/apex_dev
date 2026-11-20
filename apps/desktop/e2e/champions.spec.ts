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
  await expect(page.getByLabel("Filter champions")).toHaveCount(0);   // searching moved to the Ctrl+K palette
});

test("a champion is reached through the palette", async ({ page }) => {
  await page.goto("/#/champions");
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await page.keyboard.type("lee");
  await expect(dialog.getByRole("option").filter({ hasText: "LeeSin" })).toBeVisible();   // champion list from Data Dragon has loaded
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/champions\/LeeSin/);
});

test("opens a champion page with stats, builds and matchups", async ({ page }) => {
  await page.goto("/#/champions");
  await page.getByRole("link", { name: "Ahri" }).click();
  await expect(page).toHaveURL(/#\/champions\/Ahri/);
  await expect(page.getByRole("heading", { name: "Ahri" })).toBeVisible();
  await expect(page.getByText("Win rate (adjusted)").first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Matchups" })).toBeVisible();
  await expect(page.getByText("Skill order (max priority)")).toHaveCount(0);   // the skill order is shown once, in the recommended build
  await expect(page.getByLabel("Recommended build").getByText("Skill order", { exact: true })).toBeVisible();
});

// 40 games on 26.22 and 20 on 26.21 (see below): the change vs the last patch needs 50 in both, so the strip must show a dash, never a made-up number.
test("champion page starts with a strip of key numbers", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const strip = page.getByLabel("Key numbers");
  for (const label of ["Tier", "Win rate (adjusted)", "vs last patch", "Pick rate", "Ban rate", "Games"]) await expect(strip.getByText(label, { exact: true })).toBeVisible();
  await expect(strip.getByText(/^\d+\.\d%$/).first()).toBeVisible();            // win rate with its % sign: the colour is never the only signal
  await expect(strip.getByText("40", { exact: true })).toBeVisible();              // games
  await expect(strip.getByText("vs last patch", { exact: true }).locator("..").getByText("–")).toBeVisible();
  await expect(page.getByText("Low data: treat with caution")).toHaveCount(0);     // moved into the Games tooltip, no sentence left on the page
});

// The test backend has 40 games on 26.22 and 20 on 26.21; Ahri plays TOP in all of them. 20 games is under the 50 a win-rate change needs, so the change must be withheld.
test("champion page shows patch history, and withholds a change that has too little data", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Patch history");
  await expect(panel.getByRole("heading", { name: "Patch history" })).toBeVisible();
  const rows = panel.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("26.22"); await expect(rows.nth(0)).toContainText("NEWEST"); await expect(rows.nth(0)).toContainText("40");
  await expect(rows.nth(1)).toContainText("26.21"); await expect(rows.nth(1)).toContainText("20");
  await expect(rows.nth(0).getByTitle(/Needs at least 50 games in both patches/)).toHaveText("–");
  await expect(panel.getByRole("img", { name: /Adjusted win rate by patch: 26\.21 .*26\.22/ })).toBeVisible();
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
  await expect(panel.getByRole("group", { name: "Summoner spells Flash + Ignite" })).toBeVisible();
  await expect(panel.getByText("Skill order", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Max order Q then E then W")).toBeVisible();
  await expect(panel.getByText("First 9 levels: Q W E Q Q R Q E Q")).toBeVisible();
  await expect(panel.getByText("Starting items", { exact: true })).toBeVisible();
  await expect(panel.getByText("Build order", { exact: true })).toBeVisible();
  await expect(panel.getByText(/^Core items/)).toHaveCount(0);              // one row (the build order), not an ordered and an unordered copy
  await expect(panel.getByText(/collected games/).last()).toContainText("40");
});

test("boots are shown once: in the build order where they are bought, never again under Boots options", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build");
  const order = panel.getByLabel(/^Build order /);
  await expect(order).toHaveAttribute("aria-label", /Sorcerer's Shoes/);                 // every collected game bought the same boots: they are part of the order
  await expect(panel.getByText("Boots options")).toHaveCount(0);                         // no other boots, so no second list
  await expect(order.getByRole("img", { name: "Sorcerer's Shoes" })).toHaveCount(1);     // once in the order row (the small build summary on the left also shows the first items, so the panel as a whole has 2)
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
  // the win-rate cell uses the one shared colour scale: red under 48%, green over 52%, neutral between
  const wrCell = rows.first().locator("td").nth(2), shown = parseFloat((await wrCell.innerText()).replace("%", ""));
  await expect(wrCell.locator("span.tabular-nums").first()).toHaveClass(shown < 48 ? /text-bad/ : shown > 52 ? /text-good/ : /text-text/);   // the colour sits on the number inside the cell
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
  await expect(items.getByText(/^([+−]\d+\.\d|0\.0)$/).first()).toBeVisible();                     // a signed number in percentage points (a value that rounds to zero is a plain 0.0)
  await expect(page.getByText(/^WPA: win probability added/)).toBeVisible();
  const panel = page.getByLabel("Recommended build");
  await expect(panel.getByText(/Under each item: win rate, WPA/)).toBeVisible();
  await expect(panel.getByText(/^([+−]\d+\.\d|0\.0)$/).first()).toBeVisible();
});

test("the skill order shows the 18-level grid with one lit cell per level", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const grid = page.getByLabel("Recommended build").getByRole("table", { name: "Skill order by level" });
  await expect(grid.getByRole("columnheader")).toHaveCount(18);
  await expect(grid.locator('[data-on="true"]')).toHaveCount(18);                       // every level has exactly one skill
  await expect(grid.locator('[data-on="true"]').first()).toHaveText("Q");
  await expect(grid.getByLabel("Level 11: R")).toBeVisible();
});

test("the rune page shows the whole trees with the chosen runes lit and 3 chosen shards", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build");
  const shards = panel.getByRole("group", { name: "Stat shards" });
  await expect(shards.locator('[data-selected="true"]')).toHaveCount(3);
  await expect(shards.locator("[data-selected]")).toHaveCount(9);                      // 3 rows of 3 options
  await expect(panel.getByRole("group", { name: "Primary runes" }).locator('[data-selected="true"]')).toHaveCount(4);
  await expect(panel.getByRole("group", { name: "Secondary runes" }).locator('[data-selected="true"]')).toHaveCount(2);
});

test("build variants (AP / Tank) can be switched and sorted; the build below follows the choice", async ({ page }) => {
  await page.route("**/v1/champions/Ahri/build**", async (route) => {
    const res = await route.fetch(), body = await res.json();
    const mk = (label: string, games: number, wins: number, itemName: string) => ({ id: label, label, games, wins, build: { ...body, games, itemBlocks: [{ name: "Situational", items: [{ id: 3157, name: itemName, games, wins }] }], buildOrder: null, corePath: null } });
    await route.fulfill({ json: { ...body, variants: [mk("AP", 300, 150, "Zhonya AP variant"), mk("Tank", 100, 70, "Tank variant item")] } });
  });
  await page.goto("/#/champions/Ahri");
  const panel = page.getByLabel("Recommended build"), list = panel.getByRole("group", { name: "Build variants" });
  // Best = lower end of the 95% range: Tank (70 of 100) clears it far higher than AP (150 of 300, exactly 50%), so Tank leads and is selected.
  await expect(list.getByRole("listitem").first()).toContainText("Tank");
  await expect(list.getByRole("button", { name: /^Tank build, 100 games/ })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("img", { name: "Tank variant item" }).first()).toBeVisible();
  await list.getByRole("button", { name: /^AP build/ }).click();
  await expect(panel.getByRole("img", { name: "Zhonya AP variant" }).first()).toBeVisible();
  await expect(panel.getByText(/with AP builds/)).toBeVisible();
  await list.getByRole("button", { name: "Common", exact: true }).click();
  await expect(list.getByRole("button", { name: "Common", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(list.getByRole("listitem").first()).toContainText("AP");                 // 300 games beat 100
  await list.getByRole("button", { name: "Win rate", exact: true }).click();
  await expect(list.getByRole("listitem").first()).toContainText("Tank");               // 70% beats 50%
});

test("with Data Dragon's rune trees, every rune of the tree is listed and only the chosen ones are lit", async ({ page }) => {
  const style = (id: number, key: string) => ({ id, key, name: key, icon: `perk-images/Styles/${key}.png`,
    slots: [[8005, 8112, 8010], [8126, 8139, 8304], [8138, 8135, 8347], [8105, 8106, 8352]].map((r) => ({ runes: r.map((x) => ({ id: x, name: `Rune ${x}`, icon: `perk-images/${x}.png` })) })) });
  await page.route("**/runesReforged.json", (r) => r.fulfill({ json: [style(8000, "Precision"), style(8100, "Domination"), style(8200, "Sorcery"), style(8300, "Inspiration")] }));
  await page.goto("/#/champions/Ahri");
  const primary = page.getByLabel("Recommended build").getByRole("group", { name: "Primary runes" }), secondary = page.getByLabel("Recommended build").getByRole("group", { name: "Secondary runes" });
  await expect(primary.locator("[data-selected]")).toHaveCount(12);       // 4 rows of 3
  await expect(primary.locator('[data-selected="true"]')).toHaveCount(4);
  await expect(secondary.locator("[data-selected]")).toHaveCount(9);      // the secondary tree has no keystone row
  await expect(secondary.locator('[data-selected="true"]')).toHaveCount(2);
});

test("long explanations live in tooltips, the page keeps short lines", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  await expect(page.getByText(/^WPA: win probability added, pp/)).toHaveAttribute("title", /link, not proof/);
  await expect(page.getByText(/^vs expected:/)).toHaveAttribute("title", /overall win rates predict/);
  await expect(page.getByText(/^Change vs the patch below/)).toHaveAttribute("title", /95% range excludes 0/);
  await expect(page.getByText(/Final inventories only, so it shows a link/)).toHaveCount(0);   // the old long sentence is gone from the page text
});

test("table win rates are big numbers; the raw rate and the 95% range are one hover away (and in text for screen readers)", async ({ page }) => {
  await page.goto("/#/champions/Ahri");
  const items = page.getByRole("table").filter({ hasText: "Items" }).first();
  const big = items.locator("tbody tr").first().locator("span[title]").filter({ hasText: /^\d+(\.\d)?%$/ });
  await expect(big).toBeVisible();
  await expect(big).toHaveAttribute("title", /^Raw \d+(\.\d)?% · 95% range \d+%–\d+%$/);
  await expect(items.getByRole("columnheader", { name: "95% range" })).toHaveCount(0);      // no separate column any more
  const lux = page.getByLabel("Matchups and synergy").locator("tbody tr").first();
  await expect(lux.locator("span[title]").filter({ hasText: /^\d+(\.\d)?%$/ })).toHaveAttribute("title", /· expected \d+(\.\d)?%$/);
  await expect(lux.locator(".sr-only").first()).toContainText("95% range");
});

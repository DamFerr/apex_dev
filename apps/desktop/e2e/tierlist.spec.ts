import { expect, test } from "@playwright/test";
import { collectErrors, expectContentVisible, useFakeBackend } from "./helpers";

/** The fake backend has only 40 games, which is (rightly) too little for a tier list, so these tests feed the page a realistic response. */
const CHAMPS = [...Array.from({ length: 12 }, (_, i) => ({ id: `Champ${i}`, name: `Champ ${i}`, tags: [], roles: ["MID"], games: 900, wins: 420 + i * 8, bans: i * 30 })),
  { id: "Tiny", name: "Tiny", tags: [], roles: ["MID"], games: 10, wins: 10, bans: 0 }];

test.beforeEach(async ({ page }) => {
  await useFakeBackend(page);
  await page.route(/\/v1\/champions\?/, (r) => r.fulfill({ json: { patch: "16.22", totalGames: 10_800, champions: CHAMPS } }));
});

test("tier list groups champions into graded bands, hides low-data ones and switches role", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/tierlist");
  await expectContentVisible(page);
  await expect(page.getByRole("heading", { name: "Tier List" })).toBeVisible();
  const tiles = page.locator("main section a");
  await expect(tiles).toHaveCount(12);                                  // the 10-game champion is left out
  await expect(page.getByText("Tiny")).toHaveCount(0);
  await expect(page.getByText(/1 hidden\./)).toBeVisible();
  await expect(page.getByLabel("Tier S+")).toBeVisible();
  await page.getByRole("button", { name: "Support" }).click();
  await expect(page.getByRole("button", { name: "Support" })).toHaveAttribute("aria-pressed", "true");
  await expect(tiles.first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a champion tile opens its champion page", async ({ page }) => {
  await page.goto("/#/tierlist");
  await page.locator("main section a").first().click();
  await expect(page).toHaveURL(/#\/champions\//);
});

test("too little data shows a clear message instead of a misleading list", async ({ page }) => {
  await page.route(/\/v1\/champions\?/, (r) => r.continue());           // a later route wins: ask the fake backend itself (40 games, nothing reaches the bar)
  await page.goto("/#/tierlist");
  await expect(page.getByText(/Not enough collected games for this role/)).toBeVisible();
});

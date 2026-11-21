import { expect, test, collectErrors, expectContentVisible } from "./helpers";


test("shows both teams, marks you, bans, ranks and the hot streak, and no role icons (the order is only an estimate)", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/#/live");
  await expectContentVisible(page);
  const blue = page.getByRole("region", { name: "Blue team" });
  await expect(blue.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("region", { name: "Red team" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("you", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("img", { name: /^(Top|Jungle|Mid|ADC|Support)$/ })).toHaveCount(0); // roles are not claimed: the cards are only ordered by the estimate
  await expect(page.getByText(/^(MAIN|OFF)$/)).toHaveCount(0);
  await expect(page.getByRole("group", { name: /team bans/ }).first()).toBeVisible();
  await expect(page.getByLabel("Game time")).toContainText("6:12");
  await expect(blue.getByText("Emerald II").first()).toBeVisible();
  await expect(blue.getByText("87W 79L", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("HOT STREAK")).toHaveCount(1);
  await expect(page.getByText("Ranked Solo").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a player who is not in a game gets a clear message; bad Riot IDs are rejected", async ({ page }) => {
  await page.goto("/#/live");
  const box = page.getByLabel("Riot ID to scout");
  await box.fill("nohashtag"); await page.getByRole("button", { name: "Look up" }).click();
  await expect(page).toHaveURL(/#\/live\/?$/); // rejected, did not navigate
  await box.fill("Offline#EUW"); await page.getByRole("button", { name: "Look up" }).click();
  await expect(page).toHaveURL(/#\/live\/Offline/);
  await expect(page.getByText(/is not in a game right now/)).toBeVisible();
});

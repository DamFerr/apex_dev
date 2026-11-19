import { expect, test } from "./helpers";


test("theme and reduce-motion apply and persist across reloads", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Colorblind-safe" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "colorblind");
  await page.getByRole("switch", { name: "Reduce motion" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "colorblind");
  await expect(page.getByRole("switch", { name: "Reduce motion" })).toHaveAttribute("aria-checked", "true");
});

test("the Flash key setting defaults to F and persists across reloads", async ({ page }) => {
  await page.goto("/#/settings");
  const group = page.getByRole("group", { name: "Flash key" });
  await expect(group.getByRole("button", { name: "F (right)" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "D (left)" }).click();
  await page.reload();
  await expect(page.getByRole("group", { name: "Flash key" }).getByRole("button", { name: "D (left)" })).toHaveAttribute("aria-pressed", "true");
});

test("the compact-mode hotkey can be re-bound", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Ctrl+Shift+M" }).click();
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByRole("button", { name: "Ctrl+Shift+L" })).toBeVisible();
});

test("only finished settings are shown", async ({ page }) => {
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  // The overlay settings came back in overlay v1 (their own test is below), so only the still-unbuilt ones must stay hidden.
  for (const gone of ["Language", "Telemetry"]) await expect(page.getByText(gone)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "In-game overlay" })).toBeVisible();
});

test("your Riot ID can be changed and is validated", async ({ page }) => {
  await page.goto("/#/settings");
  const box = page.getByLabel("Your Riot ID");
  await box.fill("bad"); await box.blur();
  await expect(page.getByText("Riot ID must look like Name#TAG")).toBeVisible();
  await box.fill("Other Player#EUW"); await box.blur();
  await page.goto("/#/profile");
  await expect(page.getByRole("heading", { name: "Other Player#EUW" })).toBeVisible();
});

test.describe("first run", () => {
  test.use({ opts: { riotId: "" } });
  test("Home asks for your Riot ID and then shows your rank", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.getByText("Add your Riot ID")).toBeVisible();
    await page.getByLabel("Your Riot ID").fill("Test Player#EUW");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Emerald II")).toBeVisible();
  });
});

test("Settings can test the backend connection", async ({ page }) => {
  await page.goto("/#/settings");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Local backend is running and has an API key")).toBeVisible();
});

test("the collector is shown, covers everything, and can be paused and resumed", async ({ page }) => {
  await page.goto("/#/settings");
  await expect(page.getByText(/Paused · 60 games/)).toBeVisible();
  await expect(page.getByText(/ladders 0\/4/)).toBeVisible();
  await page.getByRole("button", { name: "Resume collector" }).click();
  await expect(page.getByText(/Collecting · 60 games/)).toBeVisible();
  await page.getByRole("button", { name: "Pause collector" }).click();
  await expect(page.getByText(/Paused · 60 games/)).toBeVisible();
});

test("overlay settings: off by default, opacity and position persist, preview needs the desktop app", async ({ page }) => {
  await page.goto("/#/settings");
  const card = page.getByRole("region", { name: "In-game overlay" });
  await expect(card.getByRole("switch", { name: "Show overlay during games" })).toHaveAttribute("aria-checked", "false");
  await expect(card.getByText(/Needs the desktop app/)).toBeVisible();      // the browser preview has no overlay window
  await expect(card.getByRole("button", { name: "Show preview" })).toBeDisabled();
  await expect(card.getByRole("group", { name: "Overlay position" }).getByRole("button", { name: "Top left" })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("button", { name: "Reset position" })).toBeDisabled();   // nothing dragged yet
  await card.getByRole("group", { name: "Overlay position" }).getByRole("button", { name: "Bottom right" }).click();
  await card.getByRole("switch", { name: "Show overlay during games" }).click();
  await card.getByLabel("Overlay opacity").fill("0.6");
  await page.reload();
  const again = page.getByRole("region", { name: "In-game overlay" });
  await expect(again.getByRole("switch", { name: "Show overlay during games" })).toHaveAttribute("aria-checked", "true");
  await expect(again.getByRole("group", { name: "Overlay position" }).getByRole("button", { name: "Bottom right" })).toHaveAttribute("aria-pressed", "true");
  await expect(again.getByText("60%")).toBeVisible();
});

test("refresh my rank after each game: on by default, can be switched off and stays off after a reload", async ({ page }) => {
  await page.goto("/#/settings");
  const sw = page.getByRole("region", { name: "Data" }).getByRole("switch", { name: "Refresh my rank after each game" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click(); await expect(sw).toHaveAttribute("aria-checked", "false");
  await page.reload(); await expect(page.getByRole("region", { name: "Data" }).getByRole("switch", { name: "Refresh my rank after each game" })).toHaveAttribute("aria-checked", "false");
});

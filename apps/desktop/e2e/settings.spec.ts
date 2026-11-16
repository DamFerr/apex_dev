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
  for (const gone of ["Overlay", "Language", "Telemetry"]) await expect(page.getByText(gone)).toHaveCount(0);
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

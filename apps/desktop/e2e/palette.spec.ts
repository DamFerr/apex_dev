import { expect, test } from "./helpers";

/** Ctrl+K palette: grouped rows (Pages, Champions, Players), keyboard use, Riot ID lookup, favourites. */
const open = async (page: import("@playwright/test").Page) => {
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  return dialog;
};
const row = (dialog: import("@playwright/test").Locator, text: string) => dialog.getByRole("option").filter({ hasText: text });

test("arrows move the highlight (wrapping), Enter opens the row, Esc closes", async ({ page }) => {
  await page.goto("/#/");
  const dialog = await open(page);
  const options = dialog.getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");   // back to the first, then wraps to the last
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/draft/);
  await expect(dialog).toBeHidden();
  await open(page); await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("a champion is found ignoring case and spaces, and Enter opens its page", async ({ page }) => {
  await page.goto("/#/");
  const dialog = await open(page);
  await page.keyboard.type("LEE sin");
  await expect(dialog.getByText("Champions", { exact: true })).toBeVisible();
  await expect(row(dialog, "LeeSin")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/champions\/LeeSin/);
  await expect(dialog).toBeHidden();
});

test("a full Riot ID offers a lookup row; opening it is remembered under Players", async ({ page }) => {
  await page.goto("/#/");
  let dialog = await open(page);
  await page.keyboard.type("Some Guy#EUW");
  await expect(row(dialog, "Look up Some Guy#EUW")).toBeVisible();
  await expect(dialog.getByText("Players", { exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/profile\/Some%20Guy%23EUW/);
  await page.goto("/#/");
  dialog = await open(page);
  await expect(row(dialog, "Some Guy#EUW")).toBeVisible();     // now a recent search, with no lookup wording
  await expect(row(dialog, "Look up")).toHaveCount(0);
});

test("Shift+Enter stars a player; favourites survive a reload", async ({ page }) => {
  await page.goto("/#/");
  let dialog = await open(page);
  await page.keyboard.type("Fav Guy#EUW");
  await page.keyboard.press("Shift+Enter");
  await expect(row(dialog, "Fav Guy#EUW").getByRole("button", { name: "Remove from favourites" })).toBeVisible();
  await expect(dialog).toBeVisible();                           // Shift+Enter does not navigate
  await page.keyboard.press("Escape");
  await page.reload();
  dialog = await open(page);
  await expect(row(dialog, "Fav Guy#EUW").getByRole("button", { name: "Remove from favourites" })).toBeVisible();
  await row(dialog, "Fav Guy#EUW").getByRole("button", { name: "Remove from favourites" }).click();   // the star toggles it off again
  await expect(row(dialog, "Fav Guy#EUW")).toHaveCount(0);
});

test("a player the backend already looked up is suggested from part of the name", async ({ page }) => {
  const looked = page.waitForResponse((r) => r.url().includes("/v1/players/Test%20Player%23EUW") && r.ok());
  await page.goto("/#/profile/Test%20Player%23EUW");
  await looked;                                                 // the backend has now stored this account
  const dialog = await open(page);
  await page.keyboard.type("testplay");
  await expect(row(dialog, "Test Player#EUW")).toBeVisible();
});

test("the palette still works when the backend is offline", async ({ page }) => {
  await page.route("http://127.0.0.1:8788/v1/players?**", (r) => r.abort());
  await page.goto("/#/");
  const dialog = await open(page);
  await page.keyboard.type("lee");
  await expect(row(dialog, "LeeSin")).toBeVisible();
});

import { expect, test } from "./helpers";


test("the palette opens a profile from a Riot ID and says so when nothing matches", async ({ page }) => {
  await page.goto("/#/");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.type("nohashtag");
  await expect(page.getByRole("dialog").getByText(/Nothing matches/)).toBeVisible();    // not a Riot ID: no lookup row
  await page.keyboard.press("Control+a"); await page.keyboard.type("Test Player#EUW");
  await expect(page.getByRole("option").filter({ hasText: "Look up Test Player#EUW" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Test Player#EUW" })).toBeVisible();
  await expect(page.getByText("Emerald II")).toBeVisible();
});

test("match history loads more on scroll, filters, and expands a match", async ({ page }) => {
  await page.goto("/#/profile");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  const main = page.locator("main");
  await expect(async () => { await main.evaluate((el) => el.scrollTo(0, el.scrollHeight)); await expect(page.getByText("End of history")).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 20_000 });
  await expect(page.getByText("25 games loaded")).toBeVisible();
  const rows = page.locator("li button[aria-expanded]");
  await page.getByRole("button", { name: "Losses" }).click();
  await expect(rows).toHaveCount(0);                         // the test player wins every game
  await page.getByRole("button", { name: "Wins" }).click();
  await expect(rows).toHaveCount(25);
  await rows.first().click();
  await expect(rows.first()).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.locator("tr.text-gold")).toHaveCount(1); // you are marked in the scoreboard
  await expect(page.getByText(/Victory|Defeat/).first()).toBeVisible();
});

test("mastery tab works, and switching tabs brings the match list back", async ({ page }) => {
  await page.goto("/#/profile");
  await page.getByRole("tab", { name: "Mastery" }).click();
  await expect(page.getByText("M10")).toBeVisible();
  await page.getByRole("tab", { name: "Match history" }).click();
  await expect(page.getByText(/games loaded/)).toBeVisible(); // infinite scroll area comes back after switching tabs
});

test("an unknown player shows a clear error", async ({ page }) => {
  await page.goto("/#/profile/Nobody%23EUW");
  await expect(page.getByText("Not found on Riot's servers")).toBeVisible();
});

test("LP history shows the chart, the promotion and honest totals", async ({ page }) => {
  await page.goto("/#/profile");
  await page.getByRole("tab", { name: "LP history" }).click();
  await expect(page.getByRole("img", { name: /LP history, 5 checks/ })).toBeVisible();
  await expect(page.getByText("Emerald II · 64 LP").first()).toBeVisible();
  await expect(page.getByText("+284 LP")).toBeVisible();              // Platinum I 80 LP -> Emerald II 64 LP
  await expect(page.getByText("46 games (27W 19L)")).toBeVisible();
  await expect(page.getByText("Promoted")).toHaveCount(3);             // Platinum I -> Emerald IV -> III -> II
  await expect(page.getByText(/not one game/)).toBeVisible();
});

test.describe("a player Apex has not seen before", () => {
  test("LP history starts with a single point and says so", async ({ page }) => {
    await page.goto("/#/profile/Fresh%20Player%23EUW");
    await page.getByRole("tab", { name: "LP history" }).click();
    await expect(page.getByText("No change yet")).toBeVisible();
    await expect(page.getByText(/Apex started tracking on/)).toBeVisible();
  });
});


test("a champion id in Riot's spelling (FiddleSticks) still shows the right name and loads the right icon file", async ({ page }) => {
  await page.route("**/v1/matches/**", (r) => r.fulfill({ json: { id: "EUW1_1", blueWon: true, participants: [{ name: "Fid", loadout: { items: [], trinket: null, spells: [], keystone: null, secondaryStyle: null },
    champion: "FiddleSticks", team: "blue", kills: 1, deaths: 1, assists: 1, cs: 1, damage: 1, gold: 1, vision: 1 }] } }));
  const icon = page.waitForRequest(/\/img\/champion\/Fiddlesticks\.png$/);
  await page.goto("/#/profile");
  await page.locator("li button[aria-expanded]").first().click();
  await expect(page.getByText("Fiddlesticks", { exact: true })).toBeVisible();
  await icon;                                                               // never .../FiddleSticks.png, which does not exist on Data Dragon
});

const row = (over: Record<string, unknown> = {}) => ({ id: "EUW1_1", champion: "Ahri", role: "MID", win: true, kills: 5, deaths: 2, assists: 9, cs: 187, durationSec: 1860, queue: "Ranked Solo", queueId: 420,
  playedAt: new Date(Date.now() - 2 * 3600_000 - 60_000).toISOString(), level: 17, loadout: { items: [3157, 3020], trinket: 3340, spells: [4, 14], keystone: 8112, secondaryStyle: 8300 }, ...over });

test("a match row is built around the champion icon: level, result, time ago, K/D/A, CS, loadout, queue", async ({ page }) => {
  await page.route("**/v1/players/**/matches**", (r) => r.fulfill({ json: { items: [row(), row({ id: "EUW1_2", win: false, level: 12, kills: 0, deaths: 4, assists: 1, queue: "ARAM", queueId: 450, playedAt: new Date(Date.now() - 3 * 86400_000).toISOString() })], nextCursor: null } }));
  await page.goto("/#/profile");
  const first = page.locator("li button[aria-expanded]").first();
  await expect(first.getByText("17", { exact: true })).toBeVisible();                  // champion level on the icon
  await expect(first.getByText("Win", { exact: true })).toBeVisible();                 // the word stays next to the colour strip
  await expect(first.getByText("2h", { exact: true })).toBeVisible();                  // short time ago
  await expect(first.getByText("5/2/9")).toBeVisible();
  await expect(first.getByText("187 CS")).toBeVisible();
  await expect(first.getByText("Ranked Solo")).toBeVisible();
  await expect(first.getByRole("group", { name: "Loadout" })).toBeVisible();           // spells, keystone, items (the same icons as the match detail)
  const second = page.locator("li button[aria-expanded]").nth(1);
  await expect(second.getByText("Loss", { exact: true })).toBeVisible();
  await expect(second.getByText("3d", { exact: true })).toBeVisible();
});

test("Home shows the same match row as Profile", async ({ page }) => {
  await page.route("**/v1/players/**/matches**", (r) => r.fulfill({ json: { items: [row()], nextCursor: null } }));
  await page.goto("/#/");
  const li = page.getByRole("listitem").filter({ hasText: "5/2/9" });
  await expect(li.getByText("17", { exact: true })).toBeVisible();
  await expect(li.getByText("2h", { exact: true })).toBeVisible();
  await expect(li.getByRole("group", { name: "Loadout" })).toBeVisible();
});

test("queue filter: chips on Profile and Home, asked of the backend, remembered per device", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/v1/players/**/matches**", (r) => { asked.push(new URL(r.request().url()).searchParams.get("queue") ?? "all"); return r.fallback(); });
  await page.goto("/#/profile");
  const chips = page.getByRole("group", { name: "Queue filter" });
  for (const label of ["All", "Ranked Solo/Duo", "Ranked Flex", "Normal Draft", "ARAM", "Arena"]) await expect(chips.getByRole("button", { name: label, exact: true })).toBeVisible();
  await expect(chips.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("10 games loaded")).toBeVisible();
  expect(asked.every((q) => q === "all")).toBe(true);                                   // no queue parameter until a chip is chosen
  await chips.getByRole("button", { name: "Ranked Flex" }).click();
  await expect.poll(() => asked.includes("flex")).toBe(true);
  await chips.getByRole("button", { name: "Arena" }).click();                           // the test player has only ranked solo games: nothing to show, said plainly
  await expect(page.getByText("No Arena games in your match history.")).toBeVisible();
  await expect(page.locator("li button[aria-expanded]")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("group", { name: "Queue filter" }).getByRole("button", { name: "Arena" })).toHaveAttribute("aria-pressed", "true");   // remembered
  await page.goto("/#/");
  await expect(page.getByRole("group", { name: "Queue filter" }).getByRole("button", { name: "Arena" })).toHaveAttribute("aria-pressed", "true");   // Home uses the same choice
  await expect(page.getByText("No games in this queue in your recent history.")).toBeVisible();
  await page.getByRole("group", { name: "Queue filter" }).getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "CS" }).first()).toBeVisible();
});

test("role chips narrow the match list on the backend and can be cleared", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/v1/players/**/matches**", (r) => { asked.push(new URL(r.request().url()).searchParams.get("role") ?? "none"); return r.fallback(); });
  await page.goto("/#/profile");
  const group = page.getByRole("group", { name: "Role and champion filter" });
  await expect(page.getByText("10 games loaded")).toBeVisible();
  expect(asked.every((r) => r === "none")).toBe(true);                       // no role parameter until a chip is chosen
  await expect(group.getByRole("button", { name: "Clear" })).toHaveCount(0);
  await group.getByRole("button", { name: "Mid", exact: true }).click();
  await expect(group.getByRole("button", { name: "Mid", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => asked.includes("MID")).toBe(true);
  await group.getByRole("button", { name: "Clear" }).click();
  await expect(group.getByRole("button", { name: "Mid", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("10 games loaded")).toBeVisible();
});

test("Home has the same role chips and shares the choice with Profile", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/v1/players/**/matches**", (r) => { asked.push(new URL(r.request().url()).searchParams.get("role") ?? "none"); return r.fallback(); });
  await page.goto("/#/");
  const group = () => page.getByRole("group", { name: "Role and champion filter" });
  await group().getByRole("button", { name: "Top", exact: true }).click();
  await expect.poll(() => asked.includes("TOP")).toBe(true);                 // asked of the backend
  await page.goto("/#/profile");
  await expect(group().getByRole("button", { name: "Top", exact: true })).toHaveAttribute("aria-pressed", "true");   // same state on Profile
});

import { expect, test } from "@playwright/test";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD must be set (from .env) to run the admin e2e spec");
}

async function login(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.fill('input[name="password"]', ADMIN_PASSWORD!);
  await Promise.all([page.waitForURL("**/admin"), page.click('button[type="submit"]')]);
}

test("unauthenticated visitors are redirected to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/admin/login");
  await page.fill('input[name="password"]', "definitely-wrong");
  await page.click('button[type="submit"]');
  await expect(page.getByText("Incorrect password.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("adding a recommended performance in the one-form admin shows it (with marker) publicly, and confirm-delete removes it", async ({
  page,
  context,
}) => {
  await login(page);

  const uniqueName = `E2E Test Act ${Date.now()}`;

  // The whole panel is a single form; fill the bottom "Add a new day" row
  // (the "new-blank" add row) and mark it recommended, so one Save both
  // creates the act and flags it.
  await page.fill('input[name="perf.new-blank.artistName"]', uniqueName);
  await page.fill('input[name="perf.new-blank.date"]', "2026-08-12");
  await page.selectOption('select[name="perf.new-blank.start"]', "16:00");
  await page.selectOption('select[name="perf.new-blank.end"]', "16:30");
  await page.check('input[name="perf.new-blank.recommended"]');

  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: "Save all changes" }).click(),
  ]);

  // After save the act is an existing row; its artist name lives in an
  // <input value>, so match on that rather than rendered text.
  await expect(page.locator(`input[value="${uniqueName}"]`)).toBeVisible();

  const publicPage = await context.newPage();
  await publicPage.goto("/");
  await publicPage.getByRole("tab", { name: /12/ }).click();
  await expect(publicPage.getByText(uniqueName)).toBeVisible();
  // Recommended, so the thumbs-up marker (an aria-hidden svg) is on the act.
  await expect(publicPage.getByRole("button", { name: new RegExp(uniqueName) }).locator("svg")).toHaveCount(1);
  await publicPage.close();

  // Delete prompts a confirm dialog; accept it, then the row is gone.
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: `Delete ${uniqueName}` }).click(),
  ]);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toHaveCount(0);

  const publicPage2 = await context.newPage();
  await publicPage2.goto("/");
  await publicPage2.getByRole("tab", { name: /12/ }).click();
  await expect(publicPage2.getByText(uniqueName)).not.toBeVisible();
  await publicPage2.close();
});

test("dismissing the delete confirm keeps the performance", async ({ page }) => {
  await login(page);

  const uniqueName = `E2E Keep Act ${Date.now()}`;
  await page.fill('input[name="perf.new-blank.artistName"]', uniqueName);
  await page.fill('input[name="perf.new-blank.date"]', "2026-08-12");
  await page.selectOption('select[name="perf.new-blank.start"]', "17:00");
  await page.selectOption('select[name="perf.new-blank.end"]', "17:30");
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: "Save all changes" }).click(),
  ]);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toBeVisible();

  // Dismiss the confirm: the row must still be there.
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: `Delete ${uniqueName}` }).click();
  await expect(page.locator(`input[value="${uniqueName}"]`)).toBeVisible();

  // Clean up (accept this time).
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: `Delete ${uniqueName}` }).click(),
  ]);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toHaveCount(0);
});

test("the public recommendations toggle hides the marker and persists across a reload", async ({
  page,
  context,
}) => {
  await login(page);

  const uniqueName = `E2E Toggle Act ${Date.now()}`;
  await page.fill('input[name="perf.new-blank.artistName"]', uniqueName);
  await page.fill('input[name="perf.new-blank.date"]', "2026-08-12");
  await page.selectOption('select[name="perf.new-blank.start"]', "18:00");
  await page.selectOption('select[name="perf.new-blank.end"]', "18:30");
  await page.check('input[name="perf.new-blank.recommended"]');
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: "Save all changes" }).click(),
  ]);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toBeVisible();

  const pub = await context.newPage();
  await pub.goto("/");
  await pub.getByRole("tab", { name: /12/ }).click();
  await expect(pub.getByRole("button", { name: new RegExp(uniqueName) }).locator("svg")).toHaveCount(1);

  // Switch recommendations off: the marker disappears.
  await pub.getByRole("switch", { name: /recommend/i }).click();
  await expect(pub.getByRole("button", { name: new RegExp(uniqueName) }).locator("svg")).toHaveCount(0);

  // The preference survives a reload (localStorage-backed).
  await pub.reload();
  await pub.getByRole("tab", { name: /12/ }).click();
  await expect(pub.getByRole("switch", { name: /recommend/i })).toHaveAttribute("aria-checked", "false");
  await expect(pub.getByRole("button", { name: new RegExp(uniqueName) }).locator("svg")).toHaveCount(0);
  await pub.close();

  // Clean up the act.
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: `Delete ${uniqueName}` }).click(),
  ]);
});

test("an early-afternoon 12:30-13:30 slot saves without a start/end error", async ({ page }) => {
  await login(page);

  const uniqueName = `E2E Afternoon Act ${Date.now()}`;
  await page.fill('input[name="perf.new-blank.artistName"]', uniqueName);
  await page.fill('input[name="perf.new-blank.date"]', "2026-08-13");
  await page.selectOption('select[name="perf.new-blank.start"]', "12:30");
  await page.selectOption('select[name="perf.new-blank.end"]', "13:30");
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: "Save all changes" }).click(),
  ]);

  // The old <13:00 roll rule pushed 12:30 to the next day, tripping this
  // error. It must save cleanly and appear as an existing row.
  await expect(page.getByText("end time must be after start time.")).toHaveCount(0);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toBeVisible();

  // Clean up.
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: `Delete ${uniqueName}` }).click(),
  ]);
});

test("logging out re-protects /admin", async ({ page }) => {
  await login(page);
  await Promise.all([page.waitForURL("**/admin/login"), page.click('button:has-text("Log out")')]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

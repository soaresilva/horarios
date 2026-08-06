import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

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

test("ticking recommended on two different rows in one save shows Saved and persists both", async ({ page }) => {
  await login(page);

  const nameA = `E2E Multi A ${Date.now()}`;
  const nameB = `E2E Multi B ${Date.now()}`;

  // Two different days' add-rows, both recommended, saved together: the
  // "tick more than one box at a time" scenario. A save bumps every row's
  // updatedAt, which remounts the whole editor once the save resolves — that
  // remount used to also wipe the "Saved." confirmation before it could ever
  // render, even though the save itself succeeded.
  await page.fill('input[name="perf.new-2026-08-12.artistName"]', nameA);
  await page.selectOption('select[name="perf.new-2026-08-12.start"]', "14:00");
  await page.selectOption('select[name="perf.new-2026-08-12.end"]', "14:30");
  await page.check('input[name="perf.new-2026-08-12.recommended"]');

  await page.fill('input[name="perf.new-2026-08-13.artistName"]', nameB);
  await page.selectOption('select[name="perf.new-2026-08-13.start"]', "15:00");
  await page.selectOption('select[name="perf.new-2026-08-13.end"]', "15:30");
  await page.check('input[name="perf.new-2026-08-13.recommended"]');

  await page.getByRole("button", { name: "Save all changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await page.waitForLoadState("networkidle");

  const artistInputA = page.locator(`input[value="${nameA}"]`);
  const artistInputB = page.locator(`input[value="${nameB}"]`);
  await expect(artistInputA).toBeVisible();
  await expect(artistInputB).toBeVisible();

  const checkboxA = artistInputA.locator("xpath=following-sibling::label[1]/input[@type='checkbox']");
  const checkboxB = artistInputB.locator("xpath=following-sibling::label[1]/input[@type='checkbox']");
  await expect(checkboxA).toBeChecked();
  await expect(checkboxB).toBeChecked();

  for (const name of [nameA, nameB]) {
    page.once("dialog", (dialog) => dialog.accept());
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: `Delete ${name}` }).click(),
    ]);
  }
});

test("a save is rejected, not silently overwritten, when the row changed elsewhere since the page loaded", async ({
  page,
}) => {
  // Regression for: a 2026-08-04 data migration fixed two performances'
  // times, then a bulk /admin save from a browser tab that had loaded the
  // page *before* the migration ran silently reverted both back to their
  // pre-fix values — the tab's uncontrolled inputs still held the old
  // values, and the save action had no way to tell that apart from a
  // genuine edit. This reproduces that scenario end to end: load the page
  // (snapshotting updatedAt), mutate the row directly in the DB (standing
  // in for "a migration ran" / "another tab saved"), then try to save from
  // the now-stale page and confirm it's rejected instead of clobbering the
  // external change.
  await login(page);

  const uniqueName = `E2E Stale Snapshot Act ${Date.now()}`;
  await page.fill('input[name="perf.new-blank.artistName"]', uniqueName);
  await page.fill('input[name="perf.new-blank.date"]', "2026-08-12");
  await page.selectOption('select[name="perf.new-blank.start"]', "19:00");
  await page.selectOption('select[name="perf.new-blank.end"]', "19:30");
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.getByRole("button", { name: "Save all changes" }).click(),
  ]);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toBeVisible();

  const created = await prisma.performance.findFirstOrThrow({ where: { artistName: uniqueName } });

  // The page currently in front of us has the freshly-created row's real
  // updatedAt snapshotted in its hidden field (the save above remounted the
  // editor with fresh data). Mutate the row directly in the DB now, as a
  // stand-in for a migration or a second admin tab saving in the meantime —
  // this is exactly what makes the open page's snapshot stale.
  await prisma.performance.update({
    where: { id: created.id },
    data: { notes: "changed out from under the open tab" },
  });

  // Save again from the now-stale page, with no further edits of our own.
  await page.getByRole("button", { name: "Save all changes" }).click();

  await expect(page.getByText(/changed elsewhere since you loaded this page/i)).toBeVisible();

  // The external change must survive — the whole point of the check.
  const afterFailedSave = await prisma.performance.findUniqueOrThrow({ where: { id: created.id } });
  expect(afterFailedSave.notes).toBe("changed out from under the open tab");

  // Clean up directly (the page's row list is now stale, so its own Delete
  // button targets a row we've already asserted on).
  await prisma.performance.delete({ where: { id: created.id } });
});

test("logging out re-protects /admin", async ({ page }) => {
  await login(page);
  await Promise.all([page.waitForURL("**/admin/login"), page.click('button:has-text("Log out")')]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

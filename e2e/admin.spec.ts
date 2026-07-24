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

test("adding a performance in admin shows it on the public timetable, and deleting removes it", async ({
  page,
  context,
}) => {
  await login(page);

  const uniqueName = `E2E Test Act ${Date.now()}`;
  const addForm = page.locator("form").filter({ has: page.locator('input[name="artistName"]') }).last();
  await addForm.locator('input[name="artistName"]').fill(uniqueName);
  await addForm.locator('input[name="date"]').fill("2026-08-12");
  await addForm.locator('input[name="startTime"]').fill("2026-08-12T16:00");
  await addForm.locator('input[name="endTime"]').fill("2026-08-12T16:30");
  await Promise.all([page.waitForLoadState("networkidle"), addForm.getByRole("button", { name: "Add" }).click()]);

  // The row is now a "Save"/"Delete" edit row for the newly created
  // performance. `hasText` won't match here — the artist name lives in an
  // <input value>, not rendered textContent — so match on the input itself.
  const editForm = page.locator("form").filter({ has: page.locator(`input[value="${uniqueName}"]`) });
  await expect(editForm).toBeVisible();

  const publicPage = await context.newPage();
  await publicPage.goto("/");
  await publicPage.getByRole("tab", { name: /12/ }).click();
  await expect(publicPage.getByText(uniqueName)).toBeVisible();
  await publicPage.close();

  await Promise.all([page.waitForLoadState("networkidle"), editForm.getByRole("button", { name: "Delete" }).click()]);
  await expect(page.locator(`input[value="${uniqueName}"]`)).toHaveCount(0);

  const publicPage2 = await context.newPage();
  await publicPage2.goto("/");
  await publicPage2.getByRole("tab", { name: /12/ }).click();
  await expect(publicPage2.getByText(uniqueName)).not.toBeVisible();
  await publicPage2.close();
});

test("logging out re-protects /admin", async ({ page }) => {
  await login(page);
  await Promise.all([page.waitForURL("**/admin/login"), page.click('button:has-text("Log out")')]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

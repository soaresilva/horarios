import { expect, test, type Page } from "@playwright/test";

// Primavera Sound 2027 is unpublished: the sets are a guess. Anonymous
// visitors must not be able to tell it from a slug that doesn't exist.
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? "");
  await Promise.all([page.waitForURL("**/admin"), page.click('button[type="submit"]')]);
}

test.describe("anonymous", () => {
  test("gets a plain 404 on the page, with nothing in the title", async ({ page }) => {
    const response = await page.goto("/ps27");
    expect(response?.status()).toBe(404);
    await expect(page).not.toHaveTitle(/Primavera/);
    await expect(page.getByText("Fontaines D.C.")).toHaveCount(0);
  });

  test("gets the same 404 from the API as for a missing festival", async ({ request }) => {
    const hidden = await request.get("/api/festivals/ps27/schedule");
    const missing = await request.get("/api/festivals/does-not-exist/schedule");
    expect(hidden.status()).toBe(404);
    expect(await hidden.text()).toBe(await missing.text());
  });

  test("doesn't see it in the archive", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.getByRole("link", { name: /London Calling/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Primavera/ })).toHaveCount(0);
  });
});

test.describe("admin", () => {
  test("sees the guess, labelled as one, on all five days", async ({ page }) => {
    await login(page);
    await page.goto("/ps27");
    await expect(page).toHaveTitle(/Primavera Sound Barcelona 2027/);
    await expect(page.getByText(/This is a guess/)).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(5);

    await page.getByRole("tab", { name: /^THU/ }).click();
    await expect(page.locator("[data-performance-id]")).toHaveCount(49);
    await expect(page.locator('[data-performance-id="ps27-p-thu-fontaines-d-c"]')).toBeAttached();

    await page.getByRole("tab", { name: /^SUN/ }).click();
    await expect(page.locator("[data-performance-id]")).toHaveCount(1);
  });

  test("can't feature it, and publishing opens it to the public until unpublished", async ({ page, browser }) => {
    await login(page);
    await expect(page.getByRole("radio", { name: /Primavera/ })).toBeDisabled();
    const row = page.locator("div", { has: page.getByRole("link", { name: /Primavera/ }) }).last();
    await expect(row.getByText("Unpublished")).toBeVisible();

    const anonymous = await browser.newContext();
    const visitor = await anonymous.newPage();
    try {
      await row.getByRole("button", { name: "Publish" }).click();
      await expect(page.getByRole("radio", { name: /Primavera/ })).toBeEnabled();
      expect((await visitor.goto("/ps27"))?.status()).toBe(200);
      await visitor.goto("/archive");
      await expect(visitor.getByRole("link", { name: /Primavera/ })).toBeVisible();
    } finally {
      await page.goto("/admin");
      const published = page.locator("div", { has: page.getByRole("link", { name: /Primavera/ }) }).last();
      await published.getByRole("button", { name: "Unpublish" }).click();
      await expect(page.getByText("Unpublished")).toBeVisible();
    }
    expect((await visitor.goto("/ps27"))?.status()).toBe(404);
    await visitor.goto("/archive");
    await expect(visitor.getByRole("link", { name: /Primavera/ })).toHaveCount(0);
    await anonymous.close();
  });
});

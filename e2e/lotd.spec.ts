import { expect, test } from "@playwright/test";

// The transposed grid's whole structure rests on CSS sticky holding on both
// axes at once. These assertions measure the pinned elements' real positions
// after scrolling, which is the only way to prove it — and they run on WebKit
// as well as Chromium, because every sticky bug this project has hit was
// Safari-only.
test.describe("Left of the Dial transposed grid", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lotd26");
    await expect(page.getByRole("tab").first()).toBeVisible();
    // Friday is the busiest day (128 sets across every room). Wednesday, the
    // default when today isn't a festival day, is a 12-act evening whose grid
    // barely overflows a desktop viewport — not enough to prove anything
    // about scrolling.
    await page.getByRole("tab", { name: /23/ }).click();
    await expect(page.locator("[data-performance-id]").first()).toBeVisible();
  });

  test("shows all four festival days with English weekday labels", async ({ page }) => {
    const tabs = await page.getByRole("tab").allInnerTexts();
    expect(tabs.join(" ")).toContain("WED");
    expect(tabs.join(" ")).toContain("SAT");
    expect(tabs).toHaveLength(4);
  });

  test("keeps the venue column pinned while scrolling sideways", async ({ page }) => {
    const scroller = page.locator("div.overflow-auto").first();
    const venue = page.locator('a[href^="https://www.google.com/maps"]').first();
    const before = await venue.boundingBox();

    await scroller.evaluate((el) => el.scrollBy(1200, 0));
    await page.waitForTimeout(300);

    const after = await venue.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(400);
  });

  test("keeps the time header pinned while scrolling down", async ({ page }) => {
    const scroller = page.locator("div.overflow-auto").first();
    const header = scroller.locator("div.sticky.top-0").first();
    const before = await header.boundingBox();

    await scroller.evaluate((el) => el.scrollBy(0, 600));
    await page.waitForTimeout(300);

    const after = await header.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  });

  test("links each venue to a map and each artist to their festival page", async ({ page }) => {
    await expect(page.locator('a[href^="https://www.google.com/maps"]').first()).toBeVisible();
    const artistLink = page.locator('a[href^="https://leftofthedial.nl/acts/"]').first();
    await expect(artistLink).toHaveAttribute("target", "_blank");
    await expect(artistLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("measures walking distances from a tapped set", async ({ page }) => {
    await expect(page.getByText(/from ticket desk/).first()).toBeVisible();

    await page.locator('[data-performance-id] button[aria-label^="Measure"]').first().evaluate((el: HTMLElement) => el.click());

    await expect(page.getByText("you are here").first()).toBeVisible();
    await expect(page.getByText(/min from (?!ticket desk)/).first()).toBeVisible();
  });

  test("stars a set independently of Paredes de Coura's own favourites", async ({ page }) => {
    const star = page.locator('[data-performance-id] button[aria-label^="Star"]').first();
    await star.evaluate((el: HTMLElement) => el.click());
    await expect(star).toHaveAttribute("aria-pressed", "true");

    const stored = await page.evaluate(() => ({
      lotd: window.localStorage.getItem("lotd26:starred"),
      pdc: window.localStorage.getItem("pdc26:starred"),
    }));
    expect(stored.lotd).toBeTruthy();
    expect(stored.pdc).toBeNull();
  });
});

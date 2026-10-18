import { expect, test, type Page } from "@playwright/test";

// London Calling is the first vertical festival with three columns: both
// Paradiso halls every night, plus De Kring (Fri) or Barlaeus (Sat). Runs on
// desktop Chromium and on an iPhone-sized WebKit, where three columns have
// to share ~330px without pushing the page sideways.
async function openDay(page: Page, day: RegExp) {
  await page.goto("/lc26oct");
  await page.getByRole("tab", { name: day }).click();
  await expect(page.locator("[data-performance-id]").first()).toBeVisible();
}

const header = (page: Page, name: string) => page.locator("div.sticky.top-0").getByText(name, { exact: true });

test.describe("London Calling three-column grid", () => {
  test("shows both nights with English weekday labels", async ({ page }) => {
    await page.goto("/lc26oct");
    await expect(page.getByRole("tab").first()).toBeVisible();
    const tabs = await page.getByRole("tab").allInnerTexts();
    expect(tabs).toHaveLength(2);
    expect(tabs.join(" ")).toMatch(/FRI[\s\S]*30/);
    expect(tabs.join(" ")).toMatch(/SAT[\s\S]*31/);
  });

  test("Friday: Small Hall, Main Hall and De Kring side by side, in poster order", async ({ page }) => {
    await openDay(page, /30/);
    const boxes = await Promise.all(
      ["Small Hall Paradiso", "Main Hall Paradiso", "De Kring"].map((n) => header(page, n).boundingBox()),
    );
    expect(boxes.every(Boolean)).toBe(true);
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x);
    expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThan(2);
    await expect(header(page, "Barlaeus")).toHaveCount(0);
    await expect(page.locator("[data-performance-id]")).toHaveCount(17);
    await expect(page.getByText("We Love 00's (Halloween club night)")).toBeVisible();
  });

  test("Saturday: Barlaeus takes the third column", async ({ page }) => {
    await openDay(page, /31/);
    await expect(header(page, "Barlaeus")).toBeVisible();
    await expect(header(page, "De Kring")).toHaveCount(0);
    await expect(page.locator("[data-performance-id]")).toHaveCount(24);
    await expect(page.locator('[data-performance-id="lc26oct-p-saturday-indiesleaze"]')).toBeAttached();
  });

  test("links artists to their London Calling page, without hijacking the mark tap", async ({ page }) => {
    await openDay(page, /30/);
    const link = page.getByRole("link", { name: "Lip Critic", exact: true });
    await expect(link).toHaveAttribute("href", "https://www.londoncalling.nl/artists/lip-critic/");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: "Lip Critic on Spotify" })).toBeAttached();

    // In a ~100px phone column the name covers most of the block's middle,
    // and a tap there opens the link (as asserted above). Anywhere else on
    // the block still marks it: tap the bottom-left corner.
    const button = page.getByRole("button", { name: /Mark Zzzahara/ });
    const box = (await button.boundingBox())!;
    await button.click({ position: { x: 4, y: box.height - 4 } });
    await expect(button).toHaveAttribute("aria-label", /must-see/);
  });

  test("never scrolls the page sideways", async ({ page }) => {
    for (const day of [/30/, /31/]) {
      await openDay(page, day);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });
});

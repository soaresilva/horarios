import { expect, test, type Page } from "@playwright/test";

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

  test("marks a set independently of Paredes de Coura's own marks", async ({ page }) => {
    const star = page.locator('[data-performance-id] button[aria-label^="Mark"]').first();
    await star.evaluate((el: HTMLElement) => el.click());
    await expect(star).toHaveAttribute("aria-label", /must-see/);

    const stored = await page.evaluate(() => ({
      lotd: window.localStorage.getItem("lotd26:starred"),
      pdc: window.localStorage.getItem("pdc26:starred"),
    }));
    expect(stored.lotd).toBeTruthy();
    expect(stored.pdc).toBeNull();
  });

  // Long-press's whole reason to exist: the grid is scrolled by dragging
  // directly on the blocks, so a touch-drag that starts on a block must
  // scroll the grid, not open the note sheet mid-drag. See useLongPress.ts's
  // 10px move-slop comment for why 10px specifically.
  //
  // scrollIntoViewIfNeeded() before EVERY press here is load-bearing, not
  // tidiness. This grid auto-scrolls horizontally to "now" on mount
  // (TransposedGrid.tsx sets scrollLeft imperatively), so on a 390px-wide
  // iPhone viewport the first block lands around x=362 with width 200 — its
  // centre is off-screen, page.mouse targets a coordinate the element
  // doesn't occupy, and no pointer event reaches it at all. Without the
  // scroll, the positive test below fails for a reason that has nothing to
  // do with long-press, and the negative one passes vacuously.
  async function pressCentre(page: Page, hold: number, drag?: number) {
    const block = page.locator("[data-performance-id]").first();
    await block.scrollIntoViewIfNeeded();
    const box = (await block.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    if (drag !== undefined) await page.mouse.move(cx + drag, cy, { steps: 10 });
    await page.waitForTimeout(hold);
    await page.mouse.up();
  }

  test("a long-press opens the mark sheet", async ({ page }) => {
    await pressCentre(page, 600);

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /Must-see/ })).toBeVisible();
  });

  // A press that turns into a drag (how this grid is actually scrolled on
  // touch — see useLongPress.ts's 10px move-slop comment) must cancel the
  // timer rather than open the sheet mid-drag. Playwright's synthetic mouse
  // drag doesn't trigger the browser's native touch-scroll, so this asserts
  // the cancellation, not an actual scroll delta — the scroll behavior
  // itself is already covered by "keeps the venue column pinned while
  // scrolling sideways" above.
  //
  // The second half is what stops this from passing vacuously: a plain
  // long-press on the same block, immediately after, MUST open the sheet. If
  // the press never reached the element (the off-screen-centre failure mode
  // described above), that assertion fails too, so a green result here means
  // the drag genuinely cancelled a press that would otherwise have fired.
  test("a press-then-drag past the slop radius cancels the long press", async ({ page }) => {
    await pressCentre(page, 600, 120);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await pressCentre(page, 600);
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  // The whole point of "display notes": a note is written once and read
  // many times, on a phone, without a long-press per set. Runs on the same
  // webkit/iPhone-14 project as the rest of this file, so this is the
  // exact mobile case the feature exists for.
  test("the display notes toggle shows/hides an inline note and the state survives reload", async ({ page }) => {
    const noteText = "sounds like Bikini Kill";

    await pressCentre(page, 600);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder(/Add note/).fill(noteText);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toHaveCount(0);

    // Off by default: the note lives behind the ✎ tooltip, not in the grid.
    await expect(page.getByText(noteText)).toHaveCount(0);

    await page.getByRole("switch", { name: /display notes/i }).click();
    await expect(page.getByText(noteText)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("tab").first()).toBeVisible();
    await page.getByRole("tab", { name: /23/ }).click();
    await expect(page.locator("[data-performance-id]").first()).toBeVisible();
    await expect(page.getByRole("switch", { name: /display notes/i })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(noteText)).toBeVisible();
  });
});

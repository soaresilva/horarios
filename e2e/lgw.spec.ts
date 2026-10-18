import { expect, test, type Page } from "@playwright/test";

// Le Guess Who? 2026: 45 rooms across Utrecht in the transposed grid, with
// the U? side programme and non-concerts (films, talks, workshops,
// exhibitions) behind two switches that start off. Needs
// `npm run import:lgw -- --apply` to have run against the e2e DB. Counts
// below are the committed snapshot's (scripts/data/lgw26.json, fetched
// 2026-10-18): re-derive them with `--check` after a re-fetch.
const blocks = "[data-performance-id]";
const uBlocks = '[data-performance-id]:has(span.border-dashed)';
const venueCells = 'a[href^="https://www.google.com/maps"]';

async function openDay(page: Page, weekday: RegExp) {
  await page.goto("/lgw26");
  await expect(page.getByRole("tab").first()).toBeVisible();
  await page.getByRole("tab", { name: weekday }).click();
  await expect(page.locator(blocks).first()).toBeVisible();
}

const uSwitch = (page: Page) => page.getByRole("switch", { name: /U\? programme/ });
const nonConcertSwitch = (page: Page) => page.getByRole("switch", { name: /films, talks/ });

test.describe("Le Guess Who? grid", () => {
  test("shows all four festival days with English weekday labels", async ({ page }) => {
    await page.goto("/lgw26");
    await expect(page.getByRole("tab").first()).toBeVisible();
    const tabs = await page.getByRole("tab").allInnerTexts();
    expect(tabs).toHaveLength(4);
    expect(tabs.join(" ")).toMatch(/THU[\s\S]*FRI[\s\S]*SAT[\s\S]*SUN/);
  });

  test("Saturday opens on the main concert programme only", async ({ page }) => {
    await openDay(page, /SAT/);
    await expect(uSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(nonConcertSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(blocks)).toHaveCount(89);
    await expect(page.locator(venueCells)).toHaveCount(17);
    await expect(page.locator(uBlocks)).toHaveCount(0);
    await expect(page.locator('[data-performance-id="lgw26-p-2448"]')).toHaveCount(0); // MUSCLE
  });

  test("the switches add U? and non-concerts, with their rooms, and survive reload", async ({ page }) => {
    await openDay(page, /SAT/);
    await uSwitch(page).click();
    await expect(page.locator('[data-performance-id="lgw26-p-2367"]')).toBeAttached(); // Woody Grooves, U?
    await expect(page.locator('[data-performance-id="lgw26-p-2367"]').getByText("U?", { exact: true })).toHaveCount(1);
    // A U? workshop needs both switches.
    await expect(page.locator('[data-performance-id="lgw26-p-2366"]')).toHaveCount(0);

    await nonConcertSwitch(page).click();
    await expect(page.locator('[data-performance-id="lgw26-p-2366"]')).toBeAttached(); // Litterbugs
    await expect(page.locator('[data-performance-id="lgw26-p-2448"]').getByText("EXPO")).toHaveCount(1);
    await expect(page.locator(blocks)).toHaveCount(127);
    await expect(page.locator(venueCells)).toHaveCount(34);

    await page.reload();
    await expect(page.getByRole("tab").first()).toBeVisible();
    await page.getByRole("tab", { name: /SAT/ }).click();
    await expect(uSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(nonConcertSwitch(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(blocks)).toHaveCount(127);
  });

  test("24 HOUR DUB runs through Saturday night on Saturday's grid", async ({ page }) => {
    await openDay(page, /SAT/);
    // CARISTA, 06:30 Sunday morning, filed under Saturday by the site.
    const carista = page.locator('[data-performance-id="lgw26-p-2138"]');
    await expect(carista).toBeAttached();
    await expect(carista).toContainText("06:30");
    // It sits to the right of Saturday's 23:00 set in the same row.
    const bugVsGhost = page.locator("[data-performance-id]", { hasText: "The Bug vs Ghost Dubs" });
    const left = (l: typeof carista) => l.evaluate((el) => (el as HTMLElement).offsetLeft);
    expect(await left(carista)).toBeGreaterThan(await left(bugVsGhost));
  });

  test("a long block keeps its name in view when its start is scrolled away", async ({ page }) => {
    await page.goto("/lgw26");
    await expect(page.getByRole("tab").first()).toBeVisible();
    await page.evaluate(() => window.localStorage.setItem("lgw26:showNonConcerts", "true"));
    await openDay(page, /THU/);
    // MUSCLE, 11:00-17:00: the first set of Thursday's window. Scroll three
    // hours in (540px at LGW's 3px/min): the block's own left edge is far
    // off-screen, and enough of it is left for the name to sit pinned rather
    // than pressed against the block's end (sticky never leaves its block).
    const block = page.locator('[data-performance-id="lgw26-p-2446"]');
    await block.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    const scroller = page.locator("div.overflow-auto").first();
    await scroller.evaluate((el) => {
      el.scrollLeft = 540;
    });
    await page.waitForTimeout(300);

    const blockBox = (await block.boundingBox())!;
    const nameBox = (await block.getByText("MUSCLE by Karimah Ashadu").boundingBox())!;
    expect(blockBox.x).toBeLessThan(-300);
    // Pinned just right of the 112px venue column, not off with the block's start.
    expect(nameBox.x).toBeGreaterThanOrEqual(112);
    expect(nameBox.x).toBeLessThan(140);
  });

  test("measures walking times from TivoliVredenburg, then from a tapped set", async ({ page }) => {
    await openDay(page, /SAT/);
    await expect(page.getByText(/min from TivoliVredenburg/).first()).toBeVisible();
    await page.locator(`${blocks} button[aria-label^="Measure"]`).first().evaluate((el: HTMLElement) => el.click());
    await expect(page.getByText("you are here").first()).toBeVisible();
  });

  test("links artists to their LGW lineup page", async ({ page }) => {
    await openDay(page, /THU/);
    const link = page.getByRole("link", { name: "Tortoise", exact: true });
    await expect(link).toHaveAttribute("href", "https://leguesswho.com/lineup/tortoise");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("marks a set independently of the other festivals", async ({ page }) => {
    await openDay(page, /THU/);
    const star = page.locator(`${blocks} button[aria-label^="Mark"]`).first();
    await star.evaluate((el: HTMLElement) => el.click());
    await expect(star).toHaveAttribute("aria-label", /must-see/);
    const stored = await page.evaluate(() => ({
      lgw: window.localStorage.getItem("lgw26:starred"),
      lotd: window.localStorage.getItem("lotd26:starred"),
    }));
    expect(stored.lgw).toBeTruthy();
    expect(stored.lotd).toBeNull();
  });

  test("an exhibition's mark sheet lists its other days", async ({ page }) => {
    await page.goto("/lgw26");
    await expect(page.getByRole("tab").first()).toBeVisible();
    await page.evaluate(() => window.localStorage.setItem("lgw26:showNonConcerts", "true"));
    await openDay(page, /THU/);
    // Opened via the block's contextmenu handler, the same onLongPress path
    // a held touch ends in. The gesture itself is covered by lotd.spec.ts;
    // this is about the data. (A real press here is unreliable on the
    // iPhone viewport: the room sits low in a short scroller that WebKit
    // keeps re-settling mid-press, which useLongPress rightly reads as a
    // drag.)
    await page
      .locator('[data-performance-id="lgw26-p-2446"] button[aria-label^="Measure"]')
      .dispatchEvent("contextmenu", { button: 2 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Exhibition");
    const also = dialog.getByText(/Also plays/);
    for (const day of ["FRI", "SAT", "SUN"]) await expect(also).toContainText(day);
  });

  test("never scrolls the page sideways", async ({ page }) => {
    await openDay(page, /SAT/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

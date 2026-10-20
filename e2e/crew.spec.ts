import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

// End-to-end for crews (src/app/crew/actions.ts, src/hooks/useCrew.ts): two
// friends on two devices, real Postgres. Starting a crew turns on sync, a
// friend joins with the code, and each one's picks show up as a tag bubble
// on the other's grid, with notes behind a tap. Also pins the per-festival
// gate: crews are on for Left of the Dial only (src/lib/festival-copy.ts).
//
// Uses a real LOTD set rather than creating one: the transposed grid lays
// rows out by venue and the test only needs a block it can find by id.
//
// Chromium only, like favorites-sync.spec.ts: the visitor cookie is Secure in
// a production build (src/lib/visitor.ts), and WebKit drops Secure cookies on
// http://localhost, so every Server Action there mints a fresh visitor and
// nothing links up. Production is https, where WebKit keeps it.

async function openFriday(page: Page) {
  await page.goto("/lotd26");
  await page.getByRole("tab", { name: /23/ }).click();
  await expect(page.locator("[data-performance-id]").first()).toBeVisible();
}

async function visitorIdOf(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "pdc_visitor_id");
  expect(cookie, "the visitor cookie is set once crews/sync are on").toBeTruthy();
  return cookie!.value;
}

// The refresh useCrew does when a tab comes back into view, instead of
// waiting out the 60s poll. bringToFront first: useCrew skips the refresh
// for a hidden tab, and with two pages open only one is in front.
async function refreshCrew(page: Page) {
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}

test("two friends share picks and notes through a crew on Left of the Dial, and nowhere else", async ({ browser }) => {
  test.setTimeout(60_000);

  const festival = await prisma.festival.findUniqueOrThrow({ where: { slug: "lotd26" } });
  const set = await prisma.performance.findFirstOrThrow({
    where: { stage: { festivalId: festival.id }, date: new Date("2026-10-23"), series: null, kind: "CONCERT" },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  a.on("dialog", (dialog) => dialog.accept());
  const visitorIds: string[] = [];
  const note = "front left, get there early";

  try {
    // A starts a crew as "D".
    await openFriday(a);
    await a.getByRole("button", { name: "crew", exact: true }).click();
    await a.getByLabel("Your tag").fill("D");
    await a.getByRole("button", { name: "Start a crew" }).click();
    const codeText = await a.locator("[data-crew-code]").innerText();
    expect(codeText).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
    await a.getByRole("button", { name: "Close" }).click();
    const visitorA = await visitorIdOf(a);
    visitorIds.push(visitorA);

    // Being in a crew switched sync on for this festival by itself.
    await expect.poll(() => a.evaluate(() => window.localStorage.getItem("lotd26:synced"))).toBe("true");

    // A marks the set must-see (star) and long-presses the block for a note.
    const blockA = a.locator(`[data-performance-id="${set.id}"]`);
    await blockA.scrollIntoViewIfNeeded();
    await blockA.locator('button[aria-label^="Mark"]').evaluate((el: HTMLElement) => el.click());
    await expect(blockA.locator('button[aria-label^="Mark"]')).toHaveAttribute("aria-label", /must-see/);
    const box = (await blockA.boundingBox())!;
    await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await a.mouse.down();
    await a.waitForTimeout(600);
    await a.mouse.up();
    await a.getByPlaceholder(/note/i).fill(note);
    await a.getByRole("button", { name: "Done" }).click();

    // Wait for A's debounced push to land, so B's join sees it straight away.
    await expect
      .poll(() => prisma.favorite.findFirst({ where: { visitorId: visitorA, performanceId: set.id } }).then((f) => f?.note ?? null))
      .toBe(note);

    // B tries A's tag first: taken. Then joins as "M".
    await openFriday(b);
    await b.getByRole("button", { name: "crew", exact: true }).click();
    await b.getByLabel("Your tag").fill("d");
    await b.getByLabel("Crew code").fill(codeText.toLowerCase());
    await b.getByRole("button", { name: "Join" }).click();
    await expect(b.getByRole("status")).toHaveText("d is taken in this crew, pick another tag.");
    await b.getByLabel("Your tag").fill("M");
    await b.getByRole("button", { name: "Join" }).click();
    await expect(b.locator("[data-crew-code]")).toHaveText(codeText);
    await expect(b.getByRole("list", { name: "Crew members" })).toContainText("D");
    await b.getByRole("button", { name: "Close" }).click();
    visitorIds.push(await visitorIdOf(b));

    // B sees A's pick as a filled "D" bubble on that set, and A's note behind a tap.
    const blockB = b.locator(`[data-performance-id="${set.id}"]`);
    await blockB.scrollIntoViewIfNeeded();
    const bubble = blockB.locator('[data-crew-tag="D"]');
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveAttribute("data-crew-tier", "must");
    await blockB.getByRole("button", { name: /^Crew:/ }).evaluate((el: HTMLElement) => el.click());
    const crewSection = b.getByRole("region", { name: "Crew" });
    await expect(crewSection).toContainText("must-see");
    await expect(crewSection).toContainText(note);
    await b.getByRole("button", { name: "Done" }).click();

    // B's own grid never shows B as a bubble.
    await expect(b.locator('[data-crew-tag="M"]')).toHaveCount(0);

    // A learns B joined on its next refresh.
    await refreshCrew(a);
    await expect(a.getByRole("button", { name: "crew (2)" })).toBeVisible();

    // A turns note sharing off: B keeps the bubble, loses the note.
    await a.getByRole("button", { name: "crew (2)" }).click();
    await a.getByRole("switch", { name: /Share my notes/ }).click();
    await expect(a.getByRole("switch", { name: /Share my notes/ })).toHaveAttribute("aria-checked", "false");
    await refreshCrew(b);
    await expect(blockB.getByRole("button", { name: /^Crew:/ })).toHaveAttribute("title", "D: must-see");

    // B's itinerary is empty of its own marks, but the crew switch lists A's pick, dimmed.
    await b.getByRole("button", { name: "My favorites" }).click();
    await expect(b.getByText(/Your crew picked 1 set/)).toBeVisible();
    await b.getByRole("switch", { name: /crew picks/ }).click();
    await expect(b.locator(`[data-performance-id="${set.id}"][data-crew-only="true"]`)).toBeVisible();

    // The gate: no crew UI on Paredes de Coura, and a crew member's marks
    // there are NOT pushed to the server.
    await a.goto("/pdc26");
    await expect(a.getByRole("tab").first()).toBeVisible();
    await expect(a.getByRole("button", { name: /^crew/ })).toHaveCount(0);
    const pdcBlock = a.locator("[data-performance-id] button[aria-label^='Mark']").first();
    await pdcBlock.evaluate((el: HTMLElement) => el.click());
    await expect(pdcBlock).toHaveAttribute("aria-label", /must-see/);
    await a.waitForTimeout(2500);
    expect(await a.evaluate(() => window.localStorage.getItem("pdc26:synced"))).toBeNull();
    const pdc = await prisma.festival.findUniqueOrThrow({ where: { slug: "pdc26" } });
    expect(await prisma.favorite.count({ where: { visitorId: visitorA, performance: { stage: { festivalId: pdc.id } } } })).toBe(0);

    // A leaves: B's bubble goes, and the crew shrinks to one.
    await openFriday(a);
    await a.getByRole("button", { name: "crew (2)" }).click();
    await a.getByRole("button", { name: "Leave crew" }).click();
    await expect(a.getByRole("button", { name: "Start a crew" })).toBeVisible();
    await b.getByRole("button", { name: "Grid" }).click();
    await refreshCrew(b);
    await expect(b.locator(`[data-performance-id="${set.id}"] [data-crew-tag="D"]`)).toHaveCount(0);
    expect(await prisma.crewMember.count({ where: { visitorId: { in: visitorIds } } })).toBe(1);
  } finally {
    await contextA.close();
    await contextB.close();
    // Guarded for the same reason as favorites-sync.spec.ts: an empty `in`
    // is fine, but never let this become an unfiltered deleteMany.
    if (visitorIds.length > 0) {
      const crews = await prisma.crewMember.findMany({ where: { visitorId: { in: visitorIds } }, select: { crewId: true } });
      await prisma.crewMember.deleteMany({ where: { visitorId: { in: visitorIds } } });
      if (crews.length > 0) await prisma.crew.deleteMany({ where: { id: { in: crews.map((c) => c.crewId) } } });
      await prisma.favorite.deleteMany({ where: { visitorId: { in: visitorIds } } });
    }
  }
});

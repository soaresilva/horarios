import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

// End-to-end for crews (src/app/crew/actions.ts, src/hooks/useCrew.ts): two
// friends on two devices, real Postgres. Starting a crew turns on sync, a
// friend joins with the code, and each one's picks show up as a tag bubble
// on the other's grid, with notes behind a tap. Also pins the per-festival
// gate: Paredes de Coura has crews off (src/lib/festival-copy.ts). The second
// test is three friends across two crews on Le Guess Who?.
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

test("two friends share picks and notes through a crew, and not where crews are off", async ({ browser }) => {
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

test("several crews on Le Guess Who?: one bubble per person, a per-crew switch, and the limits", async ({ browser }) => {
  test.setTimeout(90_000);

  const festival = await prisma.festival.findUniqueOrThrow({ where: { slug: "lgw26" } });
  const set = await prisma.performance.findFirstOrThrow({
    where: { stage: { festivalId: festival.id }, date: new Date("2026-11-06"), series: null, kind: "CONCERT" },
    orderBy: [{ startTime: "desc" }, { id: "asc" }],
  });

  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [a, b, c] = await Promise.all(contexts.map((context) => context.newPage()));
  a.on("dialog", (dialog) => dialog.accept());
  const visitorIds: string[] = [];
  const seededCrewCodes: string[] = [];

  async function openLgw(page: Page) {
    await page.goto("/lgw26");
    await page.getByRole("tab", { name: /06|\b6\b/ }).click();
    await expect(page.locator(`[data-performance-id="${set.id}"]`)).toBeAttached();
  }
  const crewButton = (page: Page) => page.getByRole("button", { name: /^crews? ?(\(\d+\))?$/ });

  async function start(page: Page, tag: string, name = "") {
    await page.getByLabel("Your tag").fill(tag);
    await page.getByLabel("Crew name").fill(name);
    await page.getByRole("button", { name: "Start a crew" }).click();
  }
  async function join(page: Page, code: string, tag: string) {
    await page.getByLabel("Your tag").fill(tag);
    await page.getByLabel("Crew code").fill(code);
    await page.getByRole("button", { name: "Join" }).click();
  }
  async function markSet(page: Page) {
    const star = page.locator(`[data-performance-id="${set.id}"] button[aria-label^="Mark"]`);
    await star.evaluate((el: HTMLElement) => el.click());
    await expect(star).toHaveAttribute("aria-label", /must-see/);
  }

  try {
    // A starts two crews, the second with no name, so it reads as its code.
    await openLgw(a);
    await crewButton(a).click();
    await start(a, "D", "LGW gang");
    await expect(a.getByRole("list", { name: "Crew members" })).toBeVisible();
    const codeX = await a.locator("[data-crew-code]").innerText();
    await a.getByRole("button", { name: "+ Start or join another" }).click();
    await expect(a.getByLabel("Your tag")).toHaveValue("D");
    await start(a, "D");
    await expect(a.locator("[data-crew-code]")).toHaveCount(2);
    const codeY = await a.locator("[data-crew-code]").nth(1).innerText();
    await expect(crewButton(a)).toHaveText(/crews \(2\)/);
    // However low the panel starts, it ends on screen and scrolls inside.
    const panel = (await a.getByRole("dialog", { name: "Crews" }).boundingBox())!;
    expect(panel.y + panel.height).toBeLessThanOrEqual(a.viewportSize()!.height);
    await a.getByRole("button", { name: "Close" }).click();
    const visitorA = await visitorIdOf(a);
    visitorIds.push(visitorA);

    // B joins both crews; C joins Y, and D is already taken there.
    await openLgw(b);
    await crewButton(b).click();
    await join(b, codeX, "M");
    await expect(b.getByRole("list", { name: "Crew members" })).toContainText("D");
    await b.getByRole("button", { name: "+ Start or join another" }).click();
    await join(b, codeY, "M");
    await expect(b.locator("[data-crew-code]")).toHaveCount(2);
    await b.getByRole("button", { name: "Close" }).click();
    const visitorB = await visitorIdOf(b);
    visitorIds.push(visitorB);

    await openLgw(c);
    await crewButton(c).click();
    await join(c, codeY, "d");
    await expect(c.getByRole("status")).toHaveText("d is taken in this crew, pick another tag.");
    await join(c, codeY, "C");
    await expect(c.locator("[data-crew-code]")).toHaveCount(1);
    await c.getByRole("button", { name: "Close" }).click();
    const visitorC = await visitorIdOf(c);
    visitorIds.push(visitorC);

    // B and C mark the same set.
    await expect.poll(() => b.evaluate(() => window.localStorage.getItem("lgw26:synced"))).toBe("true");
    await expect.poll(() => c.evaluate(() => window.localStorage.getItem("lgw26:synced"))).toBe("true");
    await markSet(b);
    await markSet(c);
    await expect
      .poll(() => prisma.favorite.count({ where: { visitorId: { in: [visitorB, visitorC] }, performanceId: set.id } }))
      .toBe(2);

    // A shares two crews with B: one "M" bubble, not two. The sheet names both crews.
    await refreshCrew(a);
    const block = a.locator(`[data-performance-id="${set.id}"]`);
    await expect(block.locator('[data-crew-tag="M"]')).toHaveCount(1);
    await expect(block.locator('[data-crew-tag="C"]')).toHaveCount(1);
    await block.getByRole("button", { name: /^Crew:/ }).evaluate((el: HTMLElement) => el.click());
    await expect(a.getByRole("region", { name: "Crew" })).toContainText(`LGW gang, ${codeY}`);
    await a.getByRole("button", { name: "Done" }).click();

    // A switches crew Y off: C goes, B stays because of crew X. Both crews stay joined.
    await crewButton(a).click();
    await a.getByRole("button", { name: new RegExp(codeY) }).click();
    await a.getByRole("switch", { name: "Show on grid" }).click();
    await expect(block.locator('[data-crew-tag="C"]')).toHaveCount(0);
    await expect(block.locator('[data-crew-tag="M"]')).toHaveCount(1);
    await expect(crewButton(a)).toHaveText(/crews \(2\)/);
    await a.getByRole("switch", { name: "Show on grid" }).click();
    await expect(block.locator('[data-crew-tag="C"]')).toHaveCount(1);
    await a.getByRole("button", { name: "Close" }).click();

    // Any member can rename a crew, and the others see it.
    await b.bringToFront();
    await crewButton(b).click();
    await b.getByLabel("Crew name").fill("Utrecht");
    await b.getByRole("button", { name: "Save name" }).click();
    await expect(b.getByRole("status")).toHaveText("Name saved.");
    await b.getByRole("button", { name: "Close" }).click();
    await refreshCrew(a);
    await crewButton(a).click();
    await expect(a.getByRole("button", { name: /Utrecht/ })).toBeVisible();

    // A leaves X and keeps Y, with B still there through Y.
    await a.getByRole("button", { name: /Utrecht/ }).click();
    await a.getByRole("button", { name: "Leave crew" }).click();
    await expect(a.locator("[data-crew-code]")).toHaveCount(1);
    await expect(crewButton(a)).toHaveText(/crew \(3\)/);
    await expect(block.locator('[data-crew-tag="M"]')).toHaveCount(1);

    // A full crew turns the 16th person away, from the server.
    const fullCode = "FQRZ22";
    seededCrewCodes.push(fullCode);
    await prisma.crew.create({
      data: {
        code: fullCode,
        members: {
          create: Array.from({ length: 15 }, (_, i) => ({
            visitorId: `e2e-full-${i}`,
            tag: `${i}`,
            tagKey: `${i}`,
            colorIndex: i,
          })),
        },
      },
    });
    await crewButton(c).click();
    await c.getByRole("button", { name: "+ Start or join another" }).click();
    await join(c, fullCode, "C");
    await expect(c.getByRole("status")).toHaveText("That crew is full (15 people).");

    // The sixth crew is refused by the server even from a panel that hasn't
    // heard about the other four yet.
    await a.getByRole("button", { name: "+ Start or join another" }).click();
    for (let i = 0; i < 4; i++) {
      const code = `SEED${i + 2}2`;
      seededCrewCodes.push(code);
      await prisma.crew.create({
        data: { code, members: { create: { visitorId: visitorA, tag: "D", tagKey: "D", colorIndex: 0 } } },
      });
    }
    await start(a, "D");
    await expect(a.getByRole("status")).toHaveText("You're in 5 crews already. Leave one first.");
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    // Guarded for the same reason as above: never an unfiltered deleteMany.
    if (visitorIds.length > 0) {
      const seats = await prisma.crewMember.findMany({ where: { visitorId: { in: visitorIds } }, select: { crewId: true } });
      if (seats.length > 0) await prisma.crew.deleteMany({ where: { id: { in: seats.map((seat) => seat.crewId) } } });
      await prisma.favorite.deleteMany({ where: { visitorId: { in: visitorIds } } });
    }
    if (seededCrewCodes.length > 0) await prisma.crew.deleteMany({ where: { code: { in: seededCrewCodes } } });
  }
});

test("pairing carries crews and picks over, whichever device enters the code, and removes no crew", async ({ browser }) => {
  test.setTimeout(90_000);

  const festival = await prisma.festival.findUniqueOrThrow({ where: { slug: "lgw26" } });
  const set = await prisma.performance.findFirstOrThrow({
    where: { stage: { festivalId: festival.id }, date: new Date("2026-11-06"), series: null, kind: "CONCERT" },
    orderBy: [{ startTime: "desc" }, { id: "asc" }],
  });

  const contexts = await Promise.all(Array.from({ length: 5 }, () => browser.newContext()));
  const [phone, friend, laptop, tablet, second] = await Promise.all(contexts.map((context) => context.newPage()));
  const visitorIds = new Set<string>();

  const syncButton = (page: Page) => page.getByRole("button", { name: /^(sync favorites|synced)$/ });

  async function openGrid(page: Page) {
    await page.goto("/lgw26");
    await page.getByRole("tab", { name: /06/ }).click();
    await expect(page.locator(`[data-performance-id="${set.id}"]`)).toBeAttached();
  }
  async function showCode(page: Page): Promise<string> {
    await syncButton(page).click();
    await page.getByRole("button", { name: "Show a code for this device" }).click();
    const code = await page.locator("p.text-xl").innerText();
    await page.getByRole("button", { name: "Close" }).click();
    return code;
  }
  async function enterCode(page: Page, code: string) {
    await syncButton(page).click();
    await page.getByRole("button", { name: "Enter a code from another device" }).click();
    await page.getByPlaceholder("123456").fill(code);
    await page.getByRole("button", { name: "Sync", exact: true }).click();
    await expect(page.getByText(/synced! your favorites now match/i)).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  }
  async function crewStart(page: Page, tag: string): Promise<string> {
    await page.getByRole("button", { name: "crew", exact: true }).click();
    await page.getByLabel("Your tag").fill(tag);
    await page.getByRole("button", { name: "Start a crew" }).click();
    const code = await page.locator("[data-crew-code]").innerText();
    await page.getByRole("button", { name: "Close" }).click();
    return code;
  }
  async function crewJoin(page: Page, code: string, tag: string) {
    await page.getByRole("button", { name: "crew", exact: true }).click();
    await page.getByLabel("Your tag").fill(tag);
    await page.getByLabel("Crew code").fill(code);
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page.locator("[data-crew-code]")).toHaveCount(1);
    await page.getByRole("button", { name: "Close" }).click();
  }

  try {
    // The phone is in a crew with a friend, and has marked a set.
    await openGrid(phone);
    const code = await crewStart(phone, "D");
    const phoneId = await visitorIdOf(phone);
    visitorIds.add(phoneId);
    await openGrid(friend);
    await crewJoin(friend, code, "M");
    visitorIds.add(await visitorIdOf(friend));
    await expect.poll(() => phone.evaluate(() => window.localStorage.getItem("lgw26:synced"))).toBe("true");
    await phone.bringToFront();
    await phone.locator(`[data-performance-id="${set.id}"] button[aria-label^="Mark"]`).evaluate((el: HTMLElement) => el.click());
    await expect.poll(() => prisma.favorite.count({ where: { visitorId: phoneId, performanceId: set.id } })).toBe(1);
    const crew = await prisma.crew.findUniqueOrThrow({ where: { code: code.replace("-", "") } });

    // The direction that used to lose crews: a new device shows the code, and
    // the device WITH the crew enters it, adopting the new device's identity.
    await openGrid(laptop);
    const laptopCode = await showCode(laptop);
    const laptopId = await visitorIdOf(laptop);
    visitorIds.add(laptopId);
    await phone.bringToFront();
    await enterCode(phone, laptopCode);
    await expect.poll(() => visitorIdOf(phone)).toBe(laptopId);

    expect(await prisma.crewMember.count({ where: { visitorId: phoneId } })).toBe(0);
    expect(await prisma.crewMember.count({ where: { visitorId: laptopId, crewId: crew.id } })).toBe(1);
    expect(await prisma.crewMember.count({ where: { crewId: crew.id } })).toBe(2);
    expect(await prisma.favorite.count({ where: { visitorId: laptopId, performanceId: set.id } })).toBe(1);

    // Both devices are in it, and the friend still sees the pick.
    await openGrid(phone);
    await expect(phone.getByRole("button", { name: "crew (2)" })).toBeVisible();
    await openGrid(laptop);
    await expect(laptop.getByRole("button", { name: "crew (2)" })).toBeVisible();
    await refreshCrew(friend);
    await expect(friend.locator(`[data-performance-id="${set.id}"] [data-crew-tag="D"]`)).toHaveCount(1);

    // Paired on a festival with crews off: the crew is there on Le Guess Who?.
    await laptop.bringToFront();
    const tabletCode = await showCode(laptop);
    await tablet.goto("/pdc26");
    await expect(tablet.getByRole("tab").first()).toBeVisible();
    await enterCode(tablet, tabletCode);
    await openGrid(tablet);
    await expect(tablet.getByRole("button", { name: "crew (2)" })).toBeVisible();

    // Both identities in the same crew: they become one seat, and the crew stays.
    await openGrid(second);
    await crewJoin(second, code, "Z");
    visitorIds.add(await visitorIdOf(second));
    expect(await prisma.crewMember.count({ where: { crewId: crew.id } })).toBe(3);
    await laptop.bringToFront();
    const secondCode = await showCode(laptop);
    await second.bringToFront();
    await enterCode(second, secondCode);
    await expect.poll(() => prisma.crewMember.count({ where: { crewId: crew.id } })).toBe(2);
    await expect(prisma.crew.findUnique({ where: { id: crew.id } })).resolves.not.toBeNull();
    await openGrid(second);
    await expect(second.getByRole("button", { name: "crew (2)" })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    const ids = Array.from(visitorIds);
    if (ids.length > 0) {
      const seats = await prisma.crewMember.findMany({ where: { visitorId: { in: ids } }, select: { crewId: true } });
      if (seats.length > 0) await prisma.crew.deleteMany({ where: { id: { in: seats.map((seat) => seat.crewId) } } });
      await prisma.favorite.deleteMany({ where: { visitorId: { in: ids } } });
    }
  }
});

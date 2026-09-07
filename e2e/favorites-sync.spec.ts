import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

// End-to-end regression for the cross-device favorites sync feature: stars
// are local-only until a visitor opts in, and pairing with a second device
// unions both devices' pre-existing stars rather than one overwriting the
// other. See the "cross-device favorites sync via pairing code" plan for the
// full design (src/app/favorites/actions.ts, src/hooks/useFavoritesSync.ts).
test("starring stays local until sync is enabled, then a pairing code merges both devices' stars", async ({
  browser,
}) => {
  // Two browser contexts doing real network round trips (opt-in, generate,
  // redeem) against Postgres comfortably exceed the 30s default.
  test.setTimeout(60_000);

  const festival = await prisma.festival.findUniqueOrThrow({ where: { slug: "pdc26" } });
  const stage = await prisma.stage.findFirstOrThrow({ where: { festivalId: festival.id, slug: "vodafone" } });

  const nameA = `E2E Sync Act A ${Date.now()}`;
  const nameB = `E2E Sync Act B ${Date.now()}`;

  // 04:00-05:30: the empty early-morning gap in the daily programme (see
  // FESTIVAL_DAY_ROLL_HOUR in src/lib/time.ts) — placing these anywhere in
  // the real evening lineup risks overlapping an existing seeded act, whose
  // absolute-positioned block then intercepts pointer events for these ones.
  const [perfA, perfB] = await Promise.all([
    prisma.performance.create({
      data: {
        artistName: nameA,
        date: new Date("2026-08-12"),
        startTime: new Date("2026-08-12T04:00:00Z"),
        endTime: new Date("2026-08-12T04:30:00Z"),
        stageId: stage.id,
      },
    }),
    prisma.performance.create({
      data: {
        artistName: nameB,
        date: new Date("2026-08-12"),
        startTime: new Date("2026-08-12T05:00:00Z"),
        endTime: new Date("2026-08-12T05:30:00Z"),
        stageId: stage.id,
      },
    }),
  ]);

  // Two independent browser contexts, not two tabs in one — favorites sync's
  // whole point is two different devices, which means two separate cookie
  // jars, exactly what separate contexts give us.
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const deviceA = await contextA.newPage();
  const deviceB = await contextB.newPage();
  let code: string | undefined;

  try {
    // Device A stars its own act before ever touching sync.
    await deviceA.goto("/pdc26");
    await deviceA.getByRole("tab", { name: /12/ }).click();
    await deviceA.getByRole("button", { name: new RegExp(nameA) }).click();
    await expect(deviceA.getByRole("button", { name: new RegExp(nameA) })).toHaveAttribute("aria-pressed", "true");

    // Nothing hit the server yet — favorites are purely local until opt-in.
    expect(await prisma.favorite.count({ where: { performanceId: perfA.id } })).toBe(0);

    // Device B independently stars a DIFFERENT act — this pre-existing local
    // list is what the pairing union has to preserve, not overwrite.
    await deviceB.goto("/pdc26");
    await deviceB.getByRole("tab", { name: /12/ }).click();
    await deviceB.getByRole("button", { name: new RegExp(nameB) }).click();
    await expect(deviceB.getByRole("button", { name: new RegExp(nameB) })).toHaveAttribute("aria-pressed", "true");

    // Device A opts into sync (its first tap on "Show a code") and generates
    // a pairing code.
    await deviceA.getByRole("button", { name: /sync favorites/i }).click();
    await deviceA.getByRole("button", { name: "Show a code for this device" }).click();
    code = await deviceA.locator("p.text-xl").innerText();
    expect(code).toMatch(/^\d{6}$/);

    // Opting in wrote Device A's own star to the server before the code was
    // ever shown (generateCode awaits startSync first).
    expect(await prisma.favorite.count({ where: { performanceId: perfA.id } })).toBe(1);

    // Device B redeems it.
    await deviceB.getByRole("button", { name: /sync favorites/i }).click();
    await deviceB.getByRole("button", { name: "Enter a code from another device" }).click();
    await deviceB.getByPlaceholder("123456").fill(code);
    await deviceB.getByRole("button", { name: "Sync", exact: true }).click();
    await expect(deviceB.getByText(/synced! your favorites now match/i)).toBeVisible();

    // Device B now shows BOTH acts starred — the union, not an overwrite of
    // its own pre-pairing list.
    await expect(deviceB.getByRole("button", { name: new RegExp(nameA) })).toHaveAttribute("aria-pressed", "true");
    await expect(deviceB.getByRole("button", { name: new RegExp(nameB) })).toHaveAttribute("aria-pressed", "true");

    // The server holds both favorites under the same (adopted) visitor id —
    // pairing means Device B took on Device A's identity.
    const [favA, favB] = await Promise.all([
      prisma.favorite.findFirstOrThrow({ where: { performanceId: perfA.id } }),
      prisma.favorite.findFirstOrThrow({ where: { performanceId: perfB.id } }),
    ]);
    expect(favA.visitorId).toBe(favB.visitorId);
  } finally {
    await contextA.close();
    await contextB.close();
    // Cascades to the Favorite rows created above. PairingCode has no FK to
    // Performance, so it needs its own cleanup.
    await prisma.performance.deleteMany({ where: { id: { in: [perfA.id, perfB.id] } } });
    // Guarded: an unset `code` would make this `deleteMany({ where: {} })` —
    // Prisma drops an undefined filter field rather than matching nothing —
    // which would wipe every PairingCode row instead of just this test's.
    if (code) await prisma.pairingCode.deleteMany({ where: { code } });
  }
});

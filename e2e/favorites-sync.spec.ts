import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

// End-to-end regression for cross-device sync of marks (must-see, interested,
// and per-slot notes): marks are local-only until a visitor opts in, and
// pairing with a second device unions both devices' pre-existing marks
// rather than one overwriting the other. See the "two-tier marks and notes"
// plan for the full design (src/app/favorites/actions.ts,
// src/hooks/useFavoritesSync.ts, src/lib/marks-merge.ts).
test("marking stays local until sync is enabled, then a pairing code merges must-see, interested and a note across both devices", async ({
  browser,
}) => {
  // Two browser contexts doing real network round trips (opt-in, generate,
  // redeem) against Postgres, plus a long-press, comfortably exceed the 30s
  // default.
  test.setTimeout(60_000);

  const festival = await prisma.festival.findUniqueOrThrow({ where: { slug: "pdc26" } });
  const stage = await prisma.stage.findFirstOrThrow({ where: { festivalId: festival.id, slug: "vodafone" } });

  const nameA = `E2E Sync Must-see ${Date.now()}`;
  const nameC = `E2E Sync Interested ${Date.now()}`;
  const nameB = `E2E Sync Device B ${Date.now()}`;

  // 04:00-06:00: the empty early-morning gap in the daily programme (see
  // FESTIVAL_DAY_ROLL_HOUR in src/lib/time.ts) — placing these anywhere in
  // the real evening lineup risks overlapping an existing seeded act, whose
  // absolute-positioned block then intercepts pointer events for these ones.
  const [perfA, perfC, perfB] = await Promise.all([
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
        artistName: nameC,
        date: new Date("2026-08-12"),
        startTime: new Date("2026-08-12T05:00:00Z"),
        endTime: new Date("2026-08-12T05:30:00Z"),
        stageId: stage.id,
      },
    }),
    prisma.performance.create({
      data: {
        artistName: nameB,
        date: new Date("2026-08-12"),
        startTime: new Date("2026-08-12T05:45:00Z"),
        endTime: new Date("2026-08-12T06:15:00Z"),
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
    // Device A marks its own act must-see (one tap) before ever touching sync.
    await deviceA.goto("/pdc26");
    await deviceA.getByRole("tab", { name: /12/ }).click();
    const blockA = deviceA.getByRole("button", { name: new RegExp(nameA) });
    await blockA.click();
    await expect(blockA).toHaveAttribute("aria-label", /must-see/);

    // Device A marks a second act interested (two taps: must-see, then
    // interested) and, via a long-press, attaches a note to it.
    const blockC = deviceA.getByRole("button", { name: new RegExp(nameC) });
    await blockC.click();
    await blockC.click();
    await expect(blockC).toHaveAttribute("aria-label", /interested/);

    const boxC = (await blockC.boundingBox())!;
    await deviceA.mouse.move(boxC.x + boxC.width / 2, boxC.y + boxC.height / 2);
    await deviceA.mouse.down();
    await deviceA.waitForTimeout(600);
    await deviceA.mouse.up();
    await expect(deviceA.getByRole("dialog")).toBeVisible();
    const note = "front left, get there early";
    await deviceA.getByPlaceholder(/note/i).fill(note);
    await deviceA.getByRole("button", { name: "Done" }).click();
    await expect(deviceA.getByRole("dialog")).not.toBeVisible();

    // Nothing hit the server yet — marks are purely local until opt-in.
    expect(await prisma.favorite.count({ where: { performanceId: { in: [perfA.id, perfC.id] } } })).toBe(0);

    // Device B independently marks a DIFFERENT act must-see — this
    // pre-existing local state is what the pairing union has to preserve,
    // not overwrite.
    await deviceB.goto("/pdc26");
    await deviceB.getByRole("tab", { name: /12/ }).click();
    const blockB = deviceB.getByRole("button", { name: new RegExp(nameB) });
    await blockB.click();
    await expect(blockB).toHaveAttribute("aria-label", /must-see/);

    // Device A opts into sync (its first tap on "Show a code") and generates
    // a pairing code.
    await deviceA.getByRole("button", { name: /sync favorites/i }).click();
    await deviceA.getByRole("button", { name: "Show a code for this device" }).click();
    code = await deviceA.locator("p.text-xl").innerText();
    expect(code).toMatch(/^\d{6}$/);

    // Opting in wrote Device A's must-see, interested tier and note to the
    // server before the code was ever shown (generateCode awaits startSync
    // first).
    await expect
      .poll(async () => prisma.favorite.count({ where: { performanceId: { in: [perfA.id, perfC.id] } } }))
      .toBe(2);
    const serverNoteRow = await prisma.favorite.findFirstOrThrow({ where: { performanceId: perfC.id } });
    expect(serverNoteRow.tier).toBe("INTERESTED");
    expect(serverNoteRow.note).toBe(note);

    // Device B redeems it.
    await deviceB.getByRole("button", { name: /sync favorites/i }).click();
    await deviceB.getByRole("button", { name: "Enter a code from another device" }).click();
    await deviceB.getByPlaceholder("123456").fill(code);
    await deviceB.getByRole("button", { name: "Sync", exact: true }).click();
    await expect(deviceB.getByText(/synced! your favorites now match/i)).toBeVisible();

    // Device B now shows all three — the union, not an overwrite of its own
    // pre-pairing must-see, and both of Device A's tiers carried over intact.
    await expect(deviceB.getByRole("button", { name: new RegExp(nameA) })).toHaveAttribute("aria-label", /must-see/);
    await expect(deviceB.getByRole("button", { name: new RegExp(nameC) })).toHaveAttribute("aria-label", /interested/);
    await expect(deviceB.getByRole("button", { name: new RegExp(nameB) })).toHaveAttribute("aria-label", /must-see/);

    // Device B can see the note too, from the favorites list view.
    await deviceB.getByRole("button", { name: "My favorites" }).click();
    await expect(deviceB.getByText(note)).toBeVisible();

    // The server holds all three favorites under the same (adopted) visitor
    // id — pairing means Device B took on Device A's identity.
    const [favA, favC, favB] = await Promise.all([
      prisma.favorite.findFirstOrThrow({ where: { performanceId: perfA.id } }),
      prisma.favorite.findFirstOrThrow({ where: { performanceId: perfC.id } }),
      prisma.favorite.findFirstOrThrow({ where: { performanceId: perfB.id } }),
    ]);
    expect(favA.visitorId).toBe(favB.visitorId);
    expect(favC.visitorId).toBe(favB.visitorId);
  } finally {
    await contextA.close();
    await contextB.close();
    // Cascades to the Favorite rows created above. PairingCode has no FK to
    // Performance, so it needs its own cleanup.
    await prisma.performance.deleteMany({ where: { id: { in: [perfA.id, perfC.id, perfB.id] } } });
    // Guarded: an unset `code` would make this `deleteMany({ where: {} })` —
    // Prisma drops an undefined filter field rather than matching nothing —
    // which would wipe every PairingCode row instead of just this test's.
    if (code) await prisma.pairingCode.deleteMany({ where: { code } });
  }
});

import { expect, test } from "@playwright/test";

test("timetable is usable offline after a first visit", async ({ page, context }) => {
  await page.goto("/pdc26");

  // Wait for the service worker to install and take control, and for it
  // to finish precaching the shell + schedule (see public/sw.js install
  // handler) before going offline.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
  await expect(page.getByText("Horários Bolachas")).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText("Horários Bolachas")).toBeVisible();
  await expect(page.getByText(/Couldn't load the schedule/)).not.toBeVisible();
  // A real stage name from the seeded schedule should render from cache.
  // Exact match: the sticky main-stage header also contains "Vodafone" as a
  // substring elsewhere, which would otherwise match twice.
  await expect(
    page.getByText("Vodafone", { exact: true }).or(page.getByText("Sobe à Vila", { exact: true })),
  ).toBeVisible();
});

test("archive index at / is usable offline after a first visit", async ({ page, context }) => {
  await page.goto("/");

  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
  await expect(page.getByText("Paredes de Coura 2026")).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText("Paredes de Coura 2026")).toBeVisible();
});

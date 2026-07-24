import { expect, test } from "@playwright/test";

test("timetable is usable offline after a first visit", async ({ page, context }) => {
  await page.goto("/");

  // Wait for the service worker to install and take control, and for it
  // to finish precaching the shell + schedule (see public/sw.js install
  // handler) before going offline.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);
  await expect(page.getByText("Paredes de Coura 2026")).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText("Paredes de Coura 2026")).toBeVisible();
  await expect(page.getByText(/Couldn't load the schedule/)).not.toBeVisible();
  // A real stage name from the seeded schedule should render from cache.
  await expect(page.getByText("Vodafone").or(page.getByText("Sobe à Vila"))).toBeVisible();
});

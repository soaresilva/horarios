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

// Regression for: a returning visitor's already-installed service worker
// intercepting a navigation whose exact URL it never cached (e.g. a route
// added after their last visit) and whose network fetch then fails — the
// service worker's networkFirst used to rethrow in that case, and a
// rejected respondWith() makes the *browser itself* render a hard
// "can't be reached" page that never reaches the app's own code. See
// public/sw.js's offlineFallback.
test("a never-visited page falls back to the offline page instead of a hard connection error", async ({
  page,
  context,
}) => {
  // Install the service worker via a normal visit first, same as every
  // other offline test — this is what a returning visitor already has.
  await page.goto("/pdc26");
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null);

  await context.setOffline(true);
  // A URL this service worker's install step never precached: SHELL_URLS
  // only precaches the bare "/pdc26" request, and Cache.match compares the
  // full URL (including query string) by default, so this is a guaranteed
  // cache miss standing in for "a route added after this visitor's service
  // worker last precached the shell" without needing a second deploy.
  await page.goto("/pdc26?simulate-uncached-route=1");

  await expect(page.getByText("Couldn't reach this page")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

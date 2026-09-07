import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  // Production build, not `next dev`: the service worker only registers in
  // production (see RegisterServiceWorker.tsx), and the offline spec needs
  // that to be real.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  // WebKit as well as Chromium: the transposed grid's frozen venue column and
  // time header are pure CSS sticky, and every sticky bug this project has
  // actually hit (stuttering scroll, unpainted headers — commits 0f12f0e and
  // ed2f728) was Safari-only. Chromium alone cannot catch that class of bug.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Scoped to the transposed grid, on a phone. The admin panel is a desktop
    // tool whose specs assume a wide viewport, and Playwright's offline
    // emulation isn't supported on WebKit (reload throws an internal error),
    // so running those here would only produce noise.
    {
      name: "webkit",
      testMatch: /lotd\.spec\.ts/,
      use: { ...devices["iPhone 14"] },
    },
  ],
});

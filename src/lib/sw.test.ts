import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync("public/sw.js", "utf8");

// Static checks: the worker runs outside the bundler, so these pin the two
// regressions that kept installs on the old festival.
describe("public/sw.js", () => {
  it("serves the manifest network-first so start_url changes reach installs", () => {
    expect(sw).toMatch(/manifest\.webmanifest"\) \{\s*event\.respondWith\(networkFirst/);
  });
  it("does not precache the redirecting / with addAll", () => {
    expect(sw).not.toMatch(/SHELL_URLS = \["\/"/);
  });
});

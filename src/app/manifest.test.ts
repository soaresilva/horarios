import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest", () => {
  // A hardcoded edition slug here pins every installed PWA to that festival;
  // "/" follows the admin's featured pick instead.
  it("starts at / so the featured festival decides what opens", () => {
    expect(manifest().start_url).toBe("/");
  });
});

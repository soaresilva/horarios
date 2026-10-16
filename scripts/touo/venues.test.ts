import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { touoStageSlug, TOUO_VENUE_TO_STAGE_SLUG } from "./venues";
import type { TouoSnapshot } from "./plan";

const snapshot = JSON.parse(
  readFileSync(path.join(process.cwd(), "scripts", "data", "touo26.json"), "utf8"),
) as TouoSnapshot;

describe("touoStageSlug", () => {
  it("maps every venue label in the committed snapshot", () => {
    for (const set of snapshot.sets) expect(() => touoStageSlug(set.venue)).not.toThrow();
  });

  it("maps every mapped label to a slug the migrations create", () => {
    // The 26 rooms from 20260907073000_add_lotd26_festival plus the four
    // from 20261016120000_add_touo_side_programme.
    const migrated = [
      "stalles", "rotown", "uniek", "v11", "mono", "reijngoud", "salsability", "arminius-down",
      "tr-down", "tr-foyer", "plato", "tramhuis", "zondebok", "time-new-space",
    ];
    for (const slug of Object.values(TOUO_VENUE_TO_STAGE_SLUG)) expect(migrated).toContain(slug);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(touoStageSlug("  Brewpub Reijngoud ")).toBe("reijngoud");
  });

  it("fails loudly on a room nobody has added yet", () => {
    expect(() => touoStageSlug("DE PLAATS")).toThrow(/Unknown TOUO venue "DE PLAATS"/);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ParsedAct } from "../../src/lib/lotd-parse";
import { stageSlugForVenue } from "./venues";

const snapshot = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "lotd26.json"), "utf8"),
) as { acts: ParsedAct[] };
const act = (slug: string) => snapshot.acts.find((a) => a.slug === slug)!;

describe("committed lotd26.json snapshot", () => {
  it("maps every venue string to a known room", () => {
    for (const a of snapshot.acts) for (const s of a.shows) expect(() => stageSlugForVenue(s.venue), `${a.slug}: ${s.venue}`).not.toThrow();
  });

  // Esmeralda Road cancelled on 2026-10-22; San Jose (already on The Official
  // Unofficial) took both slots. San Jose's page spells the room "DOELEN UP".
  it("gives Esmeralda Road's two slots to San Jose", () => {
    expect(act("esmeralda-road-ie").shows).toEqual([]);
    expect(act("san-jose-uk").shows.map((s) => [s.day, stageSlugForVenue(s.venue), s.time])).toEqual([
      ["THURSDAY", "annabel-up", "21:10"],
      ["FRIDAY", "de-doelen-up", "16:20"],
    ]);
  });
});

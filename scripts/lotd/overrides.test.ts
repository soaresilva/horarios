import { describe, expect, it } from "vitest";
import { applyShowOverrides, SHOW_OVERRIDES } from "./overrides";
import type { ParsedAct } from "../../src/lib/lotd-parse";

function act(overrides: Partial<ParsedAct>): ParsedAct {
  return {
    slug: "some-act",
    name: "Some Act",
    country: null,
    genres: null,
    spotifyUrl: null,
    instagramUrl: null,
    sourceUrl: "https://leftofthedial.nl/acts/some-act/",
    shows: [],
    ...overrides,
  };
}

describe("applyShowOverrides", () => {
  it("replaces an overridden act's shows wholesale, regardless of what was parsed", () => {
    const parsed = [
      act({
        slug: "trip-westerns-uk",
        name: "Trip Westerns",
        // The site's own (wrong) listing — duplicates Turnspit's real slots.
        shows: [
          { day: "THURSDAY", venue: "ANNABEL DOWN", time: "23:30" },
          { day: "FRIDAY", venue: "REMASTERED", time: "19:20" },
        ],
      }),
    ];

    const [corrected] = applyShowOverrides(parsed);
    expect(corrected.shows).toEqual(SHOW_OVERRIDES["trip-westerns-uk"]);
  });

  it("leaves every act without an override completely untouched", () => {
    const parsed = [act({ slug: "turnspit-uk", name: "Turnspit", shows: [{ day: "THURSDAY", venue: "ANNABEL DOWN", time: "23:30" }] })];
    const [result] = applyShowOverrides(parsed);
    expect(result).toBe(parsed[0]);
  });

  it("applies to every overridden slug currently on file, not just one", () => {
    const parsed = Object.keys(SHOW_OVERRIDES).map((slug) => act({ slug, shows: [] }));
    const corrected = applyShowOverrides(parsed);
    for (const c of corrected) {
      expect(c.shows).toEqual(SHOW_OVERRIDES[c.slug]);
    }
  });
});

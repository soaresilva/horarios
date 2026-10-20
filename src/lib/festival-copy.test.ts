import { describe, expect, it } from "vitest";
import { crewsEnabled, FESTIVAL_COPY } from "./festival-copy";

describe("crewsEnabled", () => {
  // Pinned on purpose: switching crews on for another festival also starts
  // pushing its crew members' marks to the server (useFavoritesSync), so it
  // should be a visible, deliberate change to this list.
  it("is on for Left of the Dial only", () => {
    const enabled = Object.keys(FESTIVAL_COPY).filter(crewsEnabled);
    expect(enabled).toEqual(["lotd26"]);
  });

  it("is off for a festival with no copy at all", () => {
    expect(crewsEnabled("some-future-festival")).toBe(false);
  });
});

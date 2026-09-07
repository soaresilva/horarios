import { describe, expect, it } from "vitest";
import { walkMinutesBetween, zoneWalkLabel, type ZoneLike, type ZoneWalkLike } from "./zones";

const walks: ZoneWalkLike[] = [
  { fromZoneId: "eendrachtsplein", toZoneId: "museumpark", minutes: 4 },
  { fromZoneId: "eendrachtsplein", toZoneId: "zoho", minutes: 22 },
];

const museumpark: ZoneLike = { id: "museumpark", name: "Museumpark", order: 1, walkMinutesFromHub: 4 };

describe("walkMinutesBetween", () => {
  // Walks are stored once per unordered pair, so a caller must get the same
  // answer regardless of which zone they happen to be standing in.
  it("is symmetric regardless of which direction the pair was stored", () => {
    expect(walkMinutesBetween(walks, "eendrachtsplein", "museumpark")).toBe(4);
    expect(walkMinutesBetween(walks, "museumpark", "eendrachtsplein")).toBe(4);
  });

  it("is zero within a zone", () => {
    expect(walkMinutesBetween(walks, "museumpark", "museumpark")).toBe(0);
  });

  it("returns null for a pair that was never measured, rather than guessing", () => {
    expect(walkMinutesBetween(walks, "museumpark", "zoho")).toBeNull();
  });

  it("returns null when either end is missing", () => {
    expect(walkMinutesBetween(walks, null, "museumpark")).toBeNull();
    expect(walkMinutesBetween(walks, "museumpark", undefined)).toBeNull();
  });
});

describe("zoneWalkLabel", () => {
  it("measures from the ticket desk when no set has been tapped", () => {
    expect(zoneWalkLabel(museumpark, walks, null, null)).toBe("4 min from ticket desk");
  });

  it("measures from the tapped set's venue once one is chosen", () => {
    expect(zoneWalkLabel(museumpark, walks, "eendrachtsplein", "Eendrachtsplein")).toBe(
      "4 min from Eendrachtsplein",
    );
  });

  it("says you are already there for the origin's own zone", () => {
    expect(zoneWalkLabel(museumpark, walks, "museumpark", "Museumpark")).toBe("you are here");
  });

  it("shows nothing rather than a misleading number for an unmeasured pair", () => {
    const zoho: ZoneLike = { id: "zoho", name: "ZOHO", order: 7, walkMinutesFromHub: 22 };
    expect(zoneWalkLabel(zoho, walks, "museumpark", "Museumpark")).toBeNull();
  });

  it("shows nothing when a zone has no hub distance recorded", () => {
    const unknown: ZoneLike = { id: "x", name: "X", order: 0, walkMinutesFromHub: null };
    expect(zoneWalkLabel(unknown, walks, null, null)).toBeNull();
  });
});

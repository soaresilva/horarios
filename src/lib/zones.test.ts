import { describe, expect, it } from "vitest";
import { walkMinutesBetween, walkSegmentBetweenStages, zoneWalkLabel, type ZoneLike, type ZoneWalkLike } from "./zones";

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

describe("walkSegmentBetweenStages", () => {
  const eendrachtsplein = { id: "worm-1", zoneId: "eendrachtsplein" };
  const museumpark = { id: "kunsthal", zoneId: "museumpark" };
  const zoho = { id: "wolphaert", zoneId: "zoho" };
  const vodafone = { id: "vodafone", zoneId: null };
  const palco2 = { id: "palco2", zoneId: null };

  it("is a zero-minute same-venue segment when consecutive shows share a stage", () => {
    expect(walkSegmentBetweenStages(walks, eendrachtsplein, eendrachtsplein)).toEqual({
      sameStage: true,
      minutes: 0,
    });
  });

  it("carries the measured zone-to-zone minutes for two different stages with a known pair", () => {
    expect(walkSegmentBetweenStages(walks, eendrachtsplein, museumpark)).toEqual({
      sameStage: false,
      minutes: 4,
    });
    // Symmetric regardless of which show comes first in the list.
    expect(walkSegmentBetweenStages(walks, museumpark, eendrachtsplein)).toEqual({
      sameStage: false,
      minutes: 4,
    });
  });

  it("has no minutes for a zone pair that was never measured", () => {
    expect(walkSegmentBetweenStages(walks, museumpark, zoho)).toEqual({ sameStage: false, minutes: null });
  });

  // The PdC case: stages with no zone at all (a single-site festival), so
  // there's nothing honest to show rather than a guessed distance.
  it("has no minutes for stages with no zone data", () => {
    expect(walkSegmentBetweenStages(walks, vodafone, palco2)).toEqual({ sameStage: false, minutes: null });
  });
});

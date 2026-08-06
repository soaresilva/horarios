import { describe, expect, it } from "vitest";
import {
  buildPerformanceData,
  isStaleSnapshot,
  rowUnchanged,
  type RawPerformanceRow,
  type StoredPerformance,
} from "./admin-performance";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

// 16 Aug's Dupplo set: 04:20-06:15, straddling FESTIVAL_DAY_ROLL_HOUR (06:00
// in src/lib/time.ts). Seeded via a literal timestamp in a data migration
// because fromFestivalDayTime's "hour < 6 => next day" heuristic can't
// express it (it would roll 04:20 onto the 17th while leaving 06:15 on the
// 16th, making the derived end earlier than the derived start).
const dupplo: StoredPerformance = {
  artistName: "Dupplo",
  stageId: "jazz-na-relva",
  date: new Date("2026-08-16T00:00:00Z"),
  startTime: lisbon("2026-08-16T04:20:00"),
  endTime: lisbon("2026-08-16T06:15:00"),
  notes: null,
  recommended: false,
  updatedAt: new Date("2026-08-03T18:38:00Z"),
};

const dupploRowUnchanged: RawPerformanceRow = {
  artistName: "Dupplo",
  stageId: "jazz-na-relva",
  date: "2026-08-16",
  start: "04:20",
  end: "06:15",
  notes: undefined,
  recommended: false,
};

describe("buildPerformanceData", () => {
  it("reuses the stored instants for a straddling row whose date/start/end are unchanged, instead of re-deriving from HH:MM", () => {
    // Regression for: saving any admin edit failed with "Dupplo: end time
    // must be after start time" because every existing row (including
    // untouched ones like Dupplo) was re-derived from its prefilled HH:MM
    // inputs via the naive roll heuristic.
    const result = buildPerformanceData(dupploRowUnchanged, dupplo);
    expect(result).toEqual({
      data: {
        artistName: "Dupplo",
        stageId: "jazz-na-relva",
        date: new Date("2026-08-16T00:00:00Z"),
        startTime: dupplo.startTime,
        endTime: dupplo.endTime,
        notes: null,
        recommended: false,
      },
    });
  });

  it("still reuses the stored instants when only a non-time field changes", () => {
    const result = buildPerformanceData({ ...dupploRowUnchanged, recommended: true }, dupplo);
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.startTime).toEqual(dupplo.startTime);
    expect(result.data.endTime).toEqual(dupplo.endTime);
    expect(result.data.recommended).toBe(true);
  });

  it("re-derives and validates when the admin actually edits a straddling row's own start/end", () => {
    const result = buildPerformanceData({ ...dupploRowUnchanged, start: "04:25" }, dupplo);
    expect(result).toEqual({ error: "Dupplo: end time must be after start time." });
  });

  it("rejects a genuinely inverted row with no stored row to compare against (e.g. a new add-row)", () => {
    const result = buildPerformanceData({
      artistName: "Bad Act",
      stageId: "vodafone",
      date: "2026-08-13",
      start: "23:00",
      end: "22:00",
      notes: undefined,
      recommended: false,
    });
    expect(result).toEqual({ error: "Bad Act: end time must be after start time." });
  });

  it("derives times normally for a non-straddling row with no stored counterpart", () => {
    const result = buildPerformanceData({
      artistName: "Kneecap",
      stageId: "vodafone",
      date: "2026-08-12",
      start: "01:25",
      end: "02:40",
      notes: undefined,
      recommended: false,
    });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.data.startTime).toEqual(lisbon("2026-08-13T01:25:00"));
    expect(result.data.endTime).toEqual(lisbon("2026-08-13T02:40:00"));
  });
});

describe("rowUnchanged", () => {
  it("is true when every field round-trips to the stored row", () => {
    expect(rowUnchanged(dupploRowUnchanged, dupplo)).toBe(true);
  });

  it("is false when a scalar field differs", () => {
    expect(rowUnchanged({ ...dupploRowUnchanged, recommended: true }, dupplo)).toBe(false);
  });

  it("is false when the start time differs", () => {
    expect(rowUnchanged({ ...dupploRowUnchanged, start: "04:25" }, dupplo)).toBe(false);
  });
});

describe("isStaleSnapshot", () => {
  // Regression for: a 2026-08-04 data migration fixed Ryan Davis and
  // Patrick Watson's times, then a bulk /admin save from a browser tab
  // opened before that migration ran silently reverted both back to their
  // old values on 2026-08-05 — the save action had no signal that the
  // database had moved since the page loaded, so it trusted the stale
  // form fields. This is the check that closes that gap.
  it("is false (no conflict) when the snapshot matches the row's current updatedAt", () => {
    expect(isStaleSnapshot(dupplo.updatedAt.toISOString(), dupplo)).toBe(false);
  });

  it("is true when the row's updatedAt has moved since the snapshot was taken", () => {
    const migrated = { updatedAt: new Date("2026-08-04T18:01:00.463Z") };
    const staleSnapshotFromBeforeTheMigration = new Date("2026-08-02T20:58:00Z").toISOString();
    expect(isStaleSnapshot(staleSnapshotFromBeforeTheMigration, migrated)).toBe(true);
  });

  it("is true for an empty/missing snapshot (e.g. a hidden field that failed to render)", () => {
    expect(isStaleSnapshot("", dupplo)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { formatFestivalDateRange, isFestivalOver, pickFeatured } from "./festival";

describe("isFestivalOver", () => {
  it("is false while the festival's end date is still today or in the future", () => {
    const endDate = new Date("2026-08-16T00:00:00Z");
    expect(isFestivalOver(endDate, new Date("2026-08-16T12:00:00Z"))).toBe(false);
  });

  it("is false during the day-of grace window right after endDate", () => {
    const endDate = new Date("2026-08-16T00:00:00Z");
    expect(isFestivalOver(endDate, new Date("2026-08-16T23:59:00Z"))).toBe(false);
  });

  it("is true once a full day has passed since endDate", () => {
    const endDate = new Date("2026-08-16T00:00:00Z");
    expect(isFestivalOver(endDate, new Date("2026-08-17T01:00:00Z"))).toBe(true);
  });
});

describe("formatFestivalDateRange", () => {
  it("collapses a same-month range to a single month/year", () => {
    const start = new Date("2026-08-09T00:00:00Z");
    const end = new Date("2026-08-16T00:00:00Z");
    expect(formatFestivalDateRange(start, end)).toBe("9–16 Aug 2026");
  });

  it("spells out both months for a range crossing a month boundary", () => {
    const start = new Date("2026-07-30T00:00:00Z");
    const end = new Date("2026-08-02T00:00:00Z");
    expect(formatFestivalDateRange(start, end)).toBe("30 Jul – 2 Aug 2026");
  });

  it("formats calendar-date labels in UTC, not a local/festival timezone that could shift the day", () => {
    // A @db.Date value round-trips as UTC midnight; formatting in, say,
    // Europe/Lisbon (UTC+1) would still read as the same day here, but a
    // west-of-UTC zone would push it back a day if this used local time.
    const single = new Date("2026-08-09T00:00:00Z");
    expect(formatFestivalDateRange(single, single)).toBe("9–9 Aug 2026");
  });
});

describe("pickFeatured", () => {
  it("returns the featured festival", () => {
    const list = [{ slug: "a", featured: false }, { slug: "b", featured: true }];
    expect(pickFeatured(list)?.slug).toBe("b");
  });
  it("returns undefined when none is featured or the list is empty", () => {
    expect(pickFeatured([{ featured: false }])).toBeUndefined();
    expect(pickFeatured([])).toBeUndefined();
  });
  it("takes the first (most recent) if data ever has two", () => {
    expect(pickFeatured([{ slug: "new", featured: true }, { slug: "old", featured: true }])?.slug).toBe("new");
  });
});

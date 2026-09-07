import { describe, expect, it } from "vitest";
import {
  HORIZONTAL_SCALE,
  MIN_BLOCK_HEIGHT,
  PX_PER_MINUTE,
  blockLayout,
  computeDayWindow,
  currentTimeOffset,
  formatClock,
  formatDayTabLabel,
  fromFestivalDayTime,
  fromFestivalDatetimeLocalValue,
  festivalTimeRolls,
  generateTimeTicks,
  toFestivalClockValue,
  toFestivalDatetimeLocalValue,
  todayInFestivalTimezone,
  windowExtent,
  zoneOffset,
  PDC_FESTIVAL_TIME as ft,
} from "./time";

// Helper mirroring prisma/seed.ts: build a Lisbon wall-clock instant.
function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

describe("formatClock", () => {
  it("formats a Lisbon-time instant as HH:MM regardless of host timezone", () => {
    expect(formatClock(lisbon("2026-08-13T19:40:00"), ft)).toBe("19:40");
    expect(formatClock(lisbon("2026-08-14T01:15:00"), ft)).toBe("01:15");
  });
});

describe("formatDayTabLabel", () => {
  it("returns the Portuguese weekday abbreviation and zero-padded day", () => {
    // 2026-08-13 is a Thursday.
    const { weekday, day } = formatDayTabLabel(lisbon("2026-08-13T12:00:00"), ft);
    expect(day).toBe("13");
    expect(weekday).toBe("QUI");
  });
});

// The offset used to be a hardcoded "+01:00", correct only for Portugal in
// August. These pin the replacement: PdC must resolve identically (or the
// admin write path silently rewrites every stored instant), and Amsterdam
// must come out an hour further east across the whole Left of the Dial run.
describe("zoneOffset", () => {
  const LOTD = { timezone: "Europe/Amsterdam", locale: "en-GB" };

  it("resolves +01:00 for every Paredes de Coura festival date, exactly as the old constant did", () => {
    const pdcDates = [
      "2026-08-09", "2026-08-10", "2026-08-11", "2026-08-12",
      "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16",
    ];
    for (const day of pdcDates) {
      expect(zoneOffset(ft.timezone, day)).toBe("+01:00");
    }
  });

  it("resolves +02:00 for every Left of the Dial date (Amsterdam is on CEST in October)", () => {
    for (const day of ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]) {
      expect(zoneOffset(LOTD.timezone, day)).toBe("+02:00");
    }
  });

  it("returns a signed offset for a bare-GMT zone rather than an empty string", () => {
    // ICU renders a zero offset as "GMT" with no digits; Lisbon is on GMT in
    // winter, which is what would otherwise produce an unparseable "T19:40:00".
    expect(zoneOffset("Europe/Lisbon", "2026-01-15")).toBe("+00:00");
  });

  // Amsterdam leaves CEST at 03:00 on Sun 25 Oct 2026, the morning after the
  // festival's last night. Nothing published crosses it (latest start 00:30),
  // but pin the behaviour so the next person can see where the edge is.
  it("has switched to +01:00 by the day after the festival ends", () => {
    expect(zoneOffset(LOTD.timezone, "2026-10-26")).toBe("+01:00");
  });

  it("resolves festival day-times in the festival's own zone, not a fixed offset", () => {
    // 20:00 on the Thursday of Left of the Dial is 18:00Z at +02:00.
    expect(fromFestivalDayTime("2026-10-22", "20:00", LOTD).toISOString()).toBe("2026-10-22T18:00:00.000Z");
    // The same wall-clock time at Paredes de Coura is 19:00Z at +01:00.
    expect(fromFestivalDayTime("2026-08-13", "20:00", ft).toISOString()).toBe("2026-08-13T19:00:00.000Z");
  });
});

describe("formatDayTabLabel across locales", () => {
  it("falls through to Intl's short weekday for a non-Portuguese festival", () => {
    // 2026-10-22 is a Thursday.
    const { weekday, day } = formatDayTabLabel(new Date("2026-10-22T12:00:00Z"), {
      timezone: "Europe/Amsterdam",
      locale: "en-GB",
    });
    expect(weekday).toBe("THU");
    expect(day).toBe("22");
  });
});

describe("computeDayWindow", () => {
  it("returns null for an empty performance list", () => {
    expect(computeDayWindow([])).toBeNull();
  });

  it("floors the earliest start and ceils the latest end to the hour", () => {
    const window = computeDayWindow([
      { startTime: lisbon("2026-08-13T16:45:00"), endTime: lisbon("2026-08-13T17:30:00") },
      { startTime: lisbon("2026-08-13T23:45:00"), endTime: lisbon("2026-08-14T01:00:00") },
    ]);
    expect(window).not.toBeNull();
    expect(formatClock(window!.start, ft)).toBe("16:00");
    expect(formatClock(window!.end, ft)).toBe("01:00");
  });
});

describe("blockLayout", () => {
  const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-14T02:00:00") };

  it("positions a block at minutesFromStart * PX_PER_MINUTE", () => {
    const range = { startTime: lisbon("2026-08-13T19:40:00"), endTime: lisbon("2026-08-13T20:45:00") };
    const { offset, extent } = blockLayout(window, range);
    // 19:40 is 220 minutes after the 16:00 window start.
    expect(offset).toBe(220 * PX_PER_MINUTE);
    // 65-minute set.
    expect(extent).toBe(65 * PX_PER_MINUTE);
  });

  it("floors very short sets to MIN_BLOCK_HEIGHT so the label stays legible", () => {
    const range = { startTime: lisbon("2026-08-13T16:00:00"), endTime: lisbon("2026-08-13T16:10:00") };
    const { extent } = blockLayout(window, range);
    expect(extent).toBe(MIN_BLOCK_HEIGHT);
  });

  // The transposed (Left of the Dial) layout runs the same math along the X
  // axis at a denser scale, so a 30-minute showcase set stays wide enough to
  // read an artist name in.
  it("scales to the horizontal grid when given HORIZONTAL_SCALE", () => {
    const range = { startTime: lisbon("2026-08-13T19:40:00"), endTime: lisbon("2026-08-13T20:20:00") };
    const { offset, extent } = blockLayout(window, range, HORIZONTAL_SCALE);
    expect(offset).toBe(220 * HORIZONTAL_SCALE.pxPerMinute);
    expect(extent).toBe(40 * HORIZONTAL_SCALE.pxPerMinute);
  });

  it("floors a short set to the horizontal scale's own minExtent", () => {
    const range = { startTime: lisbon("2026-08-13T19:40:00"), endTime: lisbon("2026-08-13T19:50:00") };
    const { extent } = blockLayout(window, range, HORIZONTAL_SCALE);
    expect(extent).toBe(HORIZONTAL_SCALE.minExtent);
  });
});

describe("windowExtent", () => {
  const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-14T02:00:00") };

  it("measures the whole window along the time axis, per scale", () => {
    expect(windowExtent(window)).toBe(600 * PX_PER_MINUTE);
    expect(windowExtent(window, HORIZONTAL_SCALE)).toBe(600 * HORIZONTAL_SCALE.pxPerMinute);
  });
});

describe("currentTimeOffset", () => {
  const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-14T02:00:00") };

  it("returns null when now is outside the window", () => {
    expect(currentTimeOffset(window, lisbon("2026-08-13T10:00:00"))).toBeNull();
    expect(currentTimeOffset(window, lisbon("2026-08-14T05:00:00"))).toBeNull();
  });

  it("places the line inside the Cass McCombs block (19:40-20:45) at 19:45", () => {
    const perf = { startTime: lisbon("2026-08-13T19:40:00"), endTime: lisbon("2026-08-13T20:45:00") };
    const { offset: blockOffset, extent } = blockLayout(window, perf);
    const now = lisbon("2026-08-13T19:45:00");
    const offset = currentTimeOffset(window, now);

    expect(offset).not.toBeNull();
    expect(offset!).toBeGreaterThanOrEqual(blockOffset);
    expect(offset!).toBeLessThanOrEqual(blockOffset + extent);
  });

  it("scales the marker position with the grid it's drawn on", () => {
    const now = lisbon("2026-08-13T19:40:00");
    expect(currentTimeOffset(window, now)).toBe(220 * PX_PER_MINUTE);
    expect(currentTimeOffset(window, now, HORIZONTAL_SCALE)).toBe(220 * HORIZONTAL_SCALE.pxPerMinute);
  });
});

describe("todayInFestivalTimezone", () => {
  it("returns YYYY-MM-DD anchored to Lisbon time, not the host's local date", () => {
    // 19:00 UTC on Aug 9 is 20:00 on Aug 9 in Lisbon (WEST, UTC+1) - well
    // past the 8am rollover, so it's an unambiguous same-day case.
    const eveningUtc = new Date("2026-08-09T19:00:00Z");
    expect(todayInFestivalTimezone(ft, eveningUtc)).toBe("2026-08-09");
  });

  it("does not roll to the next day at Lisbon midnight, since sets run past it", () => {
    // 23:30 UTC on Aug 9 is 00:30 on Aug 10 in Lisbon. The festival day is
    // still "Aug 9" from the visitor's perspective until 8am.
    const lateUtc = new Date("2026-08-09T23:30:00Z");
    expect(todayInFestivalTimezone(ft, lateUtc)).toBe("2026-08-09");
  });

  it("stays on the previous festival day right up to 07:59 Lisbon", () => {
    // 06:59 UTC = 07:59 Lisbon in August.
    const beforeRollover = new Date("2026-08-10T06:59:00Z");
    expect(todayInFestivalTimezone(ft, beforeRollover)).toBe("2026-08-09");
  });

  it("rolls to the next festival day exactly at 08:00 Lisbon", () => {
    // 07:00 UTC = 08:00 Lisbon in August.
    const atRollover = new Date("2026-08-10T07:00:00Z");
    expect(todayInFestivalTimezone(ft, atRollover)).toBe("2026-08-10");
  });

  it("treats Lisbon midnight itself as the previous festival day", () => {
    // 23:00 UTC = 00:00 Lisbon. Guards against ICU reporting midnight as
    // hour "24" instead of "00" and skipping the rollover check entirely.
    const midnight = new Date("2026-08-09T23:00:00Z");
    expect(todayInFestivalTimezone(ft, midnight)).toBe("2026-08-09");
  });
});

describe("Lisbon datetime-local round-trip", () => {
  it("toFestivalDatetimeLocalValue renders Lisbon wall-clock time, not UTC", () => {
    expect(toFestivalDatetimeLocalValue(lisbon("2026-08-13T19:40:00"), ft)).toBe("2026-08-13T19:40");
  });

  it("fromFestivalDatetimeLocalValue parses the value as Lisbon local time", () => {
    const parsed = fromFestivalDatetimeLocalValue("2026-08-13T19:40", ft);
    expect(parsed.getTime()).toBe(lisbon("2026-08-13T19:40:00").getTime());
  });

  it("round-trips through both directions", () => {
    const original = lisbon("2026-08-14T00:05:00");
    const value = toFestivalDatetimeLocalValue(original, ft);
    expect(fromFestivalDatetimeLocalValue(value, ft).getTime()).toBe(original.getTime());
  });
});

describe("festivalTimeRolls", () => {
  it("treats small-hours clock times (before 06:00) as the next calendar day", () => {
    expect(festivalTimeRolls("00:05")).toBe(true);
    expect(festivalTimeRolls("02:00")).toBe(true);
    expect(festivalTimeRolls("05:59")).toBe(true);
  });

  it("treats 06:00 onward — including early afternoon — as the same festival day", () => {
    expect(festivalTimeRolls("06:00")).toBe(false);
    // Regression: an early-afternoon slot must not roll onto the next day.
    expect(festivalTimeRolls("12:30")).toBe(false);
    expect(festivalTimeRolls("13:30")).toBe(false);
    expect(festivalTimeRolls("15:00")).toBe(false);
    expect(festivalTimeRolls("23:30")).toBe(false);
  });
});

describe("fromFestivalDayTime", () => {
  it("resolves an evening slot on the same calendar day", () => {
    expect(fromFestivalDayTime("2026-08-12", "20:00", ft).getTime()).toBe(lisbon("2026-08-12T20:00:00").getTime());
  });

  it("rolls an after-midnight slot onto the next calendar day", () => {
    expect(fromFestivalDayTime("2026-08-12", "02:00", ft).getTime()).toBe(lisbon("2026-08-13T02:00:00").getTime());
  });

  it("keeps an early-afternoon 12:30-13:30 set on its festival day, ordered", () => {
    // Regression for the admin bug: 12:30 must not roll to the next day while
    // 13:30 stays put, which had made end land before start.
    const start = fromFestivalDayTime("2026-08-13", "12:30", ft);
    const end = fromFestivalDayTime("2026-08-13", "13:30", ft);
    expect(start.getTime()).toBe(lisbon("2026-08-13T12:30:00").getTime());
    expect(end.getTime()).toBe(lisbon("2026-08-13T13:30:00").getTime());
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("keeps a set that straddles midnight ordered (end after start)", () => {
    const start = fromFestivalDayTime("2026-08-12", "23:30", ft);
    const end = fromFestivalDayTime("2026-08-12", "00:30", ft);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });
});

describe("toFestivalClockValue", () => {
  it("returns the Lisbon wall-clock HH:MM of an instant", () => {
    expect(toFestivalClockValue(lisbon("2026-08-13T19:40:00"), ft)).toBe("19:40");
    expect(toFestivalClockValue(lisbon("2026-08-14T00:05:00"), ft)).toBe("00:05");
  });

  it("round-trips with fromFestivalDayTime for an after-midnight slot", () => {
    // Festival-day label is the 13th, the set plays 02:00 (really the 14th).
    const instant = fromFestivalDayTime("2026-08-13", "02:00", ft);
    expect(toFestivalClockValue(instant, ft)).toBe("02:00");
  });
});

describe("generateTimeTicks", () => {
  it("generates ticks every stepMinutes and flags hour marks", () => {
    const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-13T17:00:00") };
    const ticks = generateTimeTicks(window, ft, 30);
    expect(ticks).toEqual([
      { offset: 0, label: "16:00", isHour: true, minutes: 0 },
      { offset: 30 * PX_PER_MINUTE, label: "16:30", isHour: false, minutes: 30 },
      { offset: 60 * PX_PER_MINUTE, label: "17:00", isHour: true, minutes: 60 },
    ]);
  });

  // The transposed axis draws a tick every 10 minutes but labels only every
  // 30, so it needs each tick's minute offset to decide which get a label.
  it("carries each tick's minutes and honours the horizontal scale", () => {
    const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-13T16:30:00") };
    const ticks = generateTimeTicks(window, ft, 10, HORIZONTAL_SCALE);

    expect(ticks.map((t) => t.minutes)).toEqual([0, 10, 20, 30]);
    expect(ticks.map((t) => t.offset)).toEqual(
      [0, 10, 20, 30].map((m) => m * HORIZONTAL_SCALE.pxPerMinute),
    );
    expect(ticks.filter((t) => t.minutes % 30 === 0).map((t) => t.label)).toEqual(["16:00", "16:30"]);
  });
});

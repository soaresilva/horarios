import { describe, expect, it } from "vitest";
import {
  MIN_BLOCK_HEIGHT,
  PX_PER_MINUTE,
  blockLayout,
  computeDayWindow,
  currentTimeOffset,
  formatClock,
  formatDayTabLabel,
  fromLisbonDatetimeLocalValue,
  generateTimeTicks,
  isStageOver,
  toLisbonDatetimeLocalValue,
  todayInFestivalTimezone,
} from "./time";

// Helper mirroring prisma/seed.ts: build a Lisbon wall-clock instant.
function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

describe("formatClock", () => {
  it("formats a Lisbon-time instant as HH:MM regardless of host timezone", () => {
    expect(formatClock(lisbon("2026-08-13T19:40:00"))).toBe("19:40");
    expect(formatClock(lisbon("2026-08-14T01:15:00"))).toBe("01:15");
  });
});

describe("formatDayTabLabel", () => {
  it("returns the Portuguese weekday abbreviation and zero-padded day", () => {
    // 2026-08-13 is a Thursday.
    const { weekday, day } = formatDayTabLabel(lisbon("2026-08-13T12:00:00"));
    expect(day).toBe("13");
    expect(weekday).toBe("QUI");
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
    expect(formatClock(window!.start)).toBe("16:00");
    expect(formatClock(window!.end)).toBe("01:00");
  });
});

describe("blockLayout", () => {
  const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-14T02:00:00") };

  it("positions a block at minutesFromStart * PX_PER_MINUTE", () => {
    const range = { startTime: lisbon("2026-08-13T19:40:00"), endTime: lisbon("2026-08-13T20:45:00") };
    const { top, height } = blockLayout(window, range);
    // 19:40 is 220 minutes after the 16:00 window start.
    expect(top).toBe(220 * PX_PER_MINUTE);
    // 65-minute set.
    expect(height).toBe(65 * PX_PER_MINUTE);
  });

  it("floors very short sets to MIN_BLOCK_HEIGHT so the label stays legible", () => {
    const range = { startTime: lisbon("2026-08-13T16:00:00"), endTime: lisbon("2026-08-13T16:10:00") };
    const { height } = blockLayout(window, range);
    expect(height).toBe(MIN_BLOCK_HEIGHT);
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
    const { top, height } = blockLayout(window, perf);
    const now = lisbon("2026-08-13T19:45:00");
    const offset = currentTimeOffset(window, now);

    expect(offset).not.toBeNull();
    expect(offset!).toBeGreaterThanOrEqual(top);
    expect(offset!).toBeLessThanOrEqual(top + height);
  });
});

describe("todayInFestivalTimezone", () => {
  it("returns YYYY-MM-DD anchored to Lisbon time, not the host's local date", () => {
    // 23:30 UTC on Aug 9 is already 00:30 on Aug 10 in Lisbon (WEST, UTC+1).
    const lateUtc = new Date("2026-08-09T23:30:00Z");
    expect(todayInFestivalTimezone(lateUtc)).toBe("2026-08-10");
  });
});

describe("Lisbon datetime-local round-trip", () => {
  it("toLisbonDatetimeLocalValue renders Lisbon wall-clock time, not UTC", () => {
    expect(toLisbonDatetimeLocalValue(lisbon("2026-08-13T19:40:00"))).toBe("2026-08-13T19:40");
  });

  it("fromLisbonDatetimeLocalValue parses the value as Lisbon local time", () => {
    const parsed = fromLisbonDatetimeLocalValue("2026-08-13T19:40");
    expect(parsed.getTime()).toBe(lisbon("2026-08-13T19:40:00").getTime());
  });

  it("round-trips through both directions", () => {
    const original = lisbon("2026-08-14T00:05:00");
    const value = toLisbonDatetimeLocalValue(original);
    expect(fromLisbonDatetimeLocalValue(value).getTime()).toBe(original.getTime());
  });
});

describe("isStageOver", () => {
  const performances = [
    { startTime: lisbon("2026-08-12T15:00:00"), endTime: lisbon("2026-08-12T15:45:00") },
    { startTime: lisbon("2026-08-12T16:00:00"), endTime: lisbon("2026-08-12T16:45:00") },
  ];

  it("is false before the last act ends", () => {
    expect(isStageOver(performances, lisbon("2026-08-12T16:30:00"))).toBe(false);
  });

  it("is true after the last act ends", () => {
    expect(isStageOver(performances, lisbon("2026-08-12T16:46:00"))).toBe(true);
  });

  it("is false when now isn't known yet (null)", () => {
    expect(isStageOver(performances, null)).toBe(false);
  });

  it("is false for an empty performance list", () => {
    expect(isStageOver([], lisbon("2026-08-12T20:00:00"))).toBe(false);
  });
});

describe("generateTimeTicks", () => {
  it("generates ticks every stepMinutes and flags hour marks", () => {
    const window = { start: lisbon("2026-08-13T16:00:00"), end: lisbon("2026-08-13T17:00:00") };
    const ticks = generateTimeTicks(window, 30);
    expect(ticks).toEqual([
      { offset: 0, label: "16:00", isHour: true },
      { offset: 30 * PX_PER_MINUTE, label: "16:30", isHour: false },
      { offset: 60 * PX_PER_MINUTE, label: "17:00", isHour: true },
    ]);
  });
});

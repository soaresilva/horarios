import { describe, expect, it } from "vitest";
import { DEFAULT_SET_MINUTES, withDerivedEndTimes } from "./lotd-endtimes";

// Amsterdam wall-clock during the festival is +02:00.
function ams(iso: string) {
  return new Date(`${iso}+02:00`);
}

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

describe("withDerivedEndTimes", () => {
  it("gives a well-spaced set the full 40 minutes", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "worm-1", startTime: ams("2026-10-23T19:00:00") },
      { stageSlug: "worm-1", startTime: ams("2026-10-23T20:20:00") },
    ]);
    for (const set of sets) {
      expect(minutesBetween(set.startTime, set.endTime)).toBe(DEFAULT_SET_MINUTES);
    }
  });

  it("clips a set so it never overruns the next one in the same room", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "rotown", startTime: ams("2026-10-23T19:00:00") },
      { stageSlug: "rotown", startTime: ams("2026-10-23T19:30:00") },
    ]);
    const first = sets.find((s) => s.startTime.getTime() === ams("2026-10-23T19:00:00").getTime())!;
    expect(minutesBetween(first.startTime, first.endTime)).toBe(30);
    expect(first.endTime).toEqual(ams("2026-10-23T19:30:00"));
  });

  it("does not let one room clip another room's set", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "worm-1", startTime: ams("2026-10-23T19:00:00") },
      { stageSlug: "worm-2", startTime: ams("2026-10-23T19:10:00") },
    ]);
    for (const set of sets) {
      expect(minutesBetween(set.startTime, set.endTime)).toBe(DEFAULT_SET_MINUTES);
    }
  });

  // Sorting by day label rather than instant would put 00:20 *before* 23:50
  // and clip the wrong one, or miss the adjacency entirely.
  it("treats a set just after midnight as following the one before it", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "sahara", startTime: ams("2026-10-24T00:20:00") },
      { stageSlug: "sahara", startTime: ams("2026-10-23T23:50:00") },
    ]);
    const late = sets.find((s) => s.startTime.getTime() === ams("2026-10-23T23:50:00").getTime())!;
    expect(minutesBetween(late.startTime, late.endTime)).toBe(30);
  });

  // The overnight gap between the last set of one night and the first of the
  // next is ~15 hours, so the cap must win rather than producing a set that
  // "runs" until the following afternoon.
  it("does not clip across the gap between two festival nights", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "uniek", startTime: ams("2026-10-23T23:40:00") },
      { stageSlug: "uniek", startTime: ams("2026-10-24T15:00:00") },
    ]);
    for (const set of sets) {
      expect(minutesBetween(set.startTime, set.endTime)).toBe(DEFAULT_SET_MINUTES);
    }
  });

  it("gives the last set of a room the full 40 minutes", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "v11", startTime: ams("2026-10-24T23:40:00") },
    ]);
    expect(minutesBetween(sets[0].startTime, sets[0].endTime)).toBe(DEFAULT_SET_MINUTES);
  });

  it("warns, without failing, when two sets are implausibly close together", () => {
    const { sets, warnings } = withDerivedEndTimes([
      { stageSlug: "mono", startTime: ams("2026-10-23T19:00:00") },
      { stageSlug: "mono", startTime: ams("2026-10-23T19:05:00") },
    ]);
    expect(sets).toHaveLength(2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].stageSlug).toBe("mono");
  });

  it("throws on two sets starting at the same instant in one room", () => {
    expect(() =>
      withDerivedEndTimes([
        { stageSlug: "bird", startTime: ams("2026-10-23T19:00:00") },
        { stageSlug: "bird", startTime: ams("2026-10-23T19:00:00") },
      ]),
    ).toThrow(/same time/);
  });

  it("preserves the caller's own fields", () => {
    const { sets } = withDerivedEndTimes([
      { stageSlug: "worm-1", startTime: ams("2026-10-23T19:00:00"), artistSlug: "gordi-au" },
    ]);
    expect(sets[0].artistSlug).toBe("gordi-au");
  });
});

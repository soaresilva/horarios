import { describe, expect, it } from "vitest";
import { clampMarksPayload, inlineNoteLines, markAriaLabel, NOTE_MAX_LENGTH } from "./marks";

describe("clampMarksPayload", () => {
  it("truncates a note longer than NOTE_MAX_LENGTH without touching the tiers", () => {
    const clamped = clampMarksPayload({
      mustSee: ["p1"],
      interested: [],
      notes: { p1: "x".repeat(NOTE_MAX_LENGTH + 50) },
    });

    expect(clamped.notes.p1).toHaveLength(NOTE_MAX_LENGTH);
    expect(clamped.mustSee).toEqual(["p1"]);
  });

  it("leaves a note under the limit untouched", () => {
    const clamped = clampMarksPayload({ mustSee: [], interested: [], notes: { p1: "front left" } });
    expect(clamped.notes.p1).toBe("front left");
  });
});

describe("markAriaLabel", () => {
  it("describes each tier state", () => {
    expect(markAriaLabel("Wet Leg", "must")).toBe("Mark Wet Leg: must-see, tap to change");
    expect(markAriaLabel("Wet Leg", "interested")).toBe("Mark Wet Leg: interested, tap to change");
    expect(markAriaLabel("Wet Leg", null)).toBe("Mark Wet Leg: unmarked, tap to change");
  });
});

// Boundary table from the plan: a 20-min set (40px) shows no note and keeps
// its ✎, a 30-min set (60px) gets one line, a 45-min set (90px) gets two.
// 57/58 and 73/74 are the exact thresholds where content (43px) plus N note
// lines (~14px each) first fits.
describe("inlineNoteLines", () => {
  it.each<[number, 0 | 1 | 2]>([
    [40, 0],
    [57, 0],
    [58, 1],
    [73, 1],
    [74, 2],
    [90, 2],
  ])("extent %ipx -> %i lines", (extent, expected) => {
    expect(inlineNoteLines(extent)).toBe(expected);
  });
});

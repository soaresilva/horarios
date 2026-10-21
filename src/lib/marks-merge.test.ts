import { describe, expect, it } from "vitest";
import { mergeMarks } from "./marks-merge";
import { EMPTY_MARKS_PAYLOAD, type MarksPayload } from "@/lib/marks";

function payload(overrides: Partial<MarksPayload> = {}): MarksPayload {
  return { ...EMPTY_MARKS_PAYLOAD, ...overrides };
}

describe("mergeMarks — mustSee-only cases (migrated from mergeFavoriteIds)", () => {
  it("unions disjoint lists", () => {
    const result = mergeMarks(payload({ mustSee: ["a", "b"] }), payload({ mustSee: ["c", "d"] }));
    expect(result.mustSee).toEqual(["a", "b", "c", "d"]);
  });

  it("de-dupes overlapping ids", () => {
    const result = mergeMarks(payload({ mustSee: ["a", "b"] }), payload({ mustSee: ["b", "c"] }));
    expect(result.mustSee).toEqual(["a", "b", "c"]);
  });

  it("returns the other side unchanged when one input is empty", () => {
    expect(mergeMarks(payload(), payload({ mustSee: ["a", "b"] })).mustSee).toEqual(["a", "b"]);
    expect(mergeMarks(payload({ mustSee: ["a", "b"] }), payload()).mustSee).toEqual(["a", "b"]);
  });

  it("returns an empty payload when both inputs are empty", () => {
    expect(mergeMarks(payload(), payload())).toEqual(EMPTY_MARKS_PAYLOAD);
  });

  it("never drops a server-only id even if local re-orders things", () => {
    const result = mergeMarks(payload({ mustSee: ["a", "b", "c"] }), payload({ mustSee: ["c", "b", "a"] }));
    expect(result.mustSee).toEqual(["a", "b", "c"]);
  });
});

describe("mergeMarks — tier conflicts", () => {
  it("the server's tier wins when both sides have marked the same id differently", () => {
    const result = mergeMarks(payload({ mustSee: ["a"] }), payload({ interested: ["a"] }));
    expect(result.mustSee).toEqual(["a"]);
    expect(result.interested).toEqual([]);
  });

  it("falls back to the local tier when only the local side has marked an id", () => {
    const result = mergeMarks(payload(), payload({ interested: ["a"] }));
    expect(result.interested).toEqual(["a"]);
  });

  it("unions across mustSee and interested from both sides", () => {
    const result = mergeMarks(
      payload({ mustSee: ["a"], interested: ["b"] }),
      payload({ mustSee: ["c"], interested: ["d"] }),
    );
    expect(result.mustSee).toEqual(["a", "c"]);
    expect(result.interested).toEqual(["b", "d"]);
  });
});

describe("mergeMarks — note conflicts", () => {
  it("the server's note wins when both sides wrote one for the same id", () => {
    const result = mergeMarks(
      payload({ mustSee: ["a"], notes: { a: "server note" } }),
      payload({ mustSee: ["a"], notes: { a: "local note" } }),
    );
    expect(result.notes.a).toBe("server note");
  });

  it("falls back to the local note when the server has none for that id", () => {
    const result = mergeMarks(payload({ mustSee: ["a"] }), payload({ mustSee: ["a"], notes: { a: "local note" } }));
    expect(result.notes.a).toBe("local note");
  });

  it("falls back to the local note when the server's is an empty string", () => {
    const result = mergeMarks(
      payload({ mustSee: ["a"], notes: { a: "" } }),
      payload({ mustSee: ["a"], notes: { a: "local note" } }),
    );
    expect(result.notes.a).toBe("local note");
  });

  it("a note survives on an id that carries no tier on either side", () => {
    const result = mergeMarks(payload({ notes: { a: "server note" } }), payload());
    expect(result.notes.a).toBe("server note");
    expect(result.mustSee).toEqual([]);
    expect(result.interested).toEqual([]);
  });
});

describe("mergeMarks — hidden acts", () => {
  it("unions both sides' hidden acts, server first, without duplicates", () => {
    const merged = mergeMarks(payload({ hidden: ["name:a", "artist-b"] }), payload({ hidden: ["artist-b", "name:c"] }));
    expect(merged.hidden).toEqual(["name:a", "artist-b", "name:c"]);
  });

  it("keeps a hide from either side when the other has none", () => {
    expect(mergeMarks(payload(), payload({ hidden: ["name:a"] })).hidden).toEqual(["name:a"]);
    expect(mergeMarks(payload({ hidden: ["name:a"] }), payload()).hidden).toEqual(["name:a"]);
  });

  // Hiding is per act and tiers are per set, so the merge keeps both and
  // leaves it to the grid: isGridVisible keeps a marked set on screen.
  it("doesn't drop a tier because the other side hid the act", () => {
    const merged = mergeMarks(payload({ mustSee: ["p1"] }), payload({ hidden: ["name:a"] }));
    expect(merged.mustSee).toEqual(["p1"]);
    expect(merged.hidden).toEqual(["name:a"]);
  });
});

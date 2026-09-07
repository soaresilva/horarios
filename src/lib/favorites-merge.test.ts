import { describe, expect, it } from "vitest";
import { mergeFavoriteIds } from "./favorites-merge";

describe("mergeFavoriteIds", () => {
  it("unions disjoint lists", () => {
    expect(mergeFavoriteIds(["a", "b"], ["c", "d"])).toEqual(["a", "b", "c", "d"]);
  });

  it("de-dupes overlapping ids", () => {
    expect(mergeFavoriteIds(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns the other side unchanged when one input is empty", () => {
    expect(mergeFavoriteIds([], ["a", "b"])).toEqual(["a", "b"]);
    expect(mergeFavoriteIds(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("returns an empty array when both inputs are empty", () => {
    expect(mergeFavoriteIds([], [])).toEqual([]);
  });

  it("never drops a server-only id even if local re-orders things", () => {
    const result = mergeFavoriteIds(["a", "b", "c"], ["c", "b", "a"]);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

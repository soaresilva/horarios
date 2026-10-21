import { describe, expect, it } from "vitest";
import { actKeysById, countHiddenActs, idsOfAct, isGridVisible } from "./hidden";

const sets = [
  { id: "a1", artistId: "artist-a", artistName: "August" },
  { id: "a2", artistId: "artist-a", artistName: "August" },
  { id: "g1", artistId: null, artistName: "Gordi" },
  { id: "g2", artistId: null, artistName: "gordi " },
];

describe("actKeysById", () => {
  it("maps every set to its act key", () => {
    expect(actKeysById(sets)).toEqual(
      new Map([
        ["a1", "artist-a"],
        ["a2", "artist-a"],
        ["g1", "name:gordi"],
        ["g2", "name:gordi"],
      ]),
    );
  });
});

describe("idsOfAct", () => {
  it("collects every set of the act, by Artist id or by normalised name", () => {
    expect(idsOfAct(sets, "artist-a")).toEqual(["a1", "a2"]);
    expect(idsOfAct(sets, "name:gordi")).toEqual(["g1", "g2"]);
    expect(idsOfAct(sets, "name:nobody")).toEqual([]);
  });
});

describe("isGridVisible", () => {
  it.each([
    // actHidden, tier, showHidden, visible
    [false, null, false, true],
    [false, "must", false, true],
    [true, null, false, false],
    [true, null, true, true],
    [true, "must", false, true],
    [true, "interested", false, true],
  ] as const)("actHidden=%s tier=%s showHidden=%s → %s", (actHidden, tier, showHidden, visible) => {
    expect(isGridVisible({ actHidden, tier, showHidden })).toBe(visible);
  });
});

describe("countHiddenActs", () => {
  const index = actKeysById(sets);

  it("counts hidden acts that still have sets on this festival", () => {
    expect(countHiddenActs(["artist-a", "name:gordi"], index)).toBe(2);
  });

  it("skips keys no set matches (an act renamed or dropped since it was hidden)", () => {
    expect(countHiddenActs(["artist-a", "name:gone"], index)).toBe(1);
    expect(countHiddenActs([], index)).toBe(0);
  });
});

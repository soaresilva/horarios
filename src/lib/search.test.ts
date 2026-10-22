import { describe, expect, it } from "vitest";
import { foldForSearch, searchPerformances } from "./search";

function set(id: string, artistName: string, startISO: string) {
  return { id, artistName, artistId: null, startTime: new Date(startISO) };
}

const performances = [
  set("bcnr-sat", "Black Country, New Road", "2026-10-24T21:00:00Z"),
  set("bcnr-fri", "Black Country, New Road", "2026-10-23T20:00:00Z"),
  set("barbara", "Bárbara Tinoco", "2026-10-23T18:00:00Z"),
  set("newhvn", "[cancelled] newhvn", "2026-10-23T19:00:00Z"),
  set("gordi", "Gordi", "2026-10-22T19:00:00Z"),
];

const ids = (query: string) => searchPerformances(performances, query).map((p) => p.id);

describe("foldForSearch", () => {
  it("lowercases, trims and strips accents", () => {
    expect(foldForSearch("  Bárbara ÉÇÃ ")).toBe("barbara eca");
  });
});

describe("searchPerformances", () => {
  it("matches case-insensitively", () => {
    expect(ids("GORDI")).toEqual(["gordi"]);
  });

  it("ignores accents in either direction", () => {
    expect(ids("barbara")).toEqual(["barbara"]);
    expect(ids("bárbara")).toEqual(["barbara"]);
    expect(searchPerformances([set("x", "Barbara", "2026-10-23T18:00:00Z")], "bárb").map((p) => p.id)).toEqual(["x"]);
  });

  it("needs every word, in any order, anywhere in the name", () => {
    expect(ids("road country")).toEqual(["bcnr-fri", "bcnr-sat"]);
    expect(ids("country gordi")).toEqual([]);
  });

  it("returns every set of a matching act, across days, chronologically", () => {
    expect(ids("new road")).toEqual(["bcnr-fri", "bcnr-sat"]);
  });

  it("matches partial words, which is what typing on a phone produces", () => {
    expect(ids("gor")).toEqual(["gordi"]);
  });

  it("matches nothing for an empty or whitespace-only query", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });

  it("searches the display name, so the [cancelled] prefix isn't a match", () => {
    expect(ids("cancelled")).toEqual([]);
    expect(ids("newhvn")).toEqual(["newhvn"]);
  });

  it("doesn't mutate the input order", () => {
    const before = performances.map((p) => p.id);
    searchPerformances(performances, "new");
    expect(performances.map((p) => p.id)).toEqual(before);
  });
});

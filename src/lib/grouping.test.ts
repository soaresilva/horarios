import { describe, expect, it } from "vitest";
import { mainStages, otherStages, performancesForDate, uniqueSortedDates, activeStagesSortedByOrder, stagesByZone } from "./grouping";

const stages = [
  { id: "vodafone", slug: "vodafone", order: 0 },
  { id: "palco2", slug: "palco-2", order: 1 },
  { id: "sobe-a-vila", slug: "sobe-a-vila", order: 2 },
  { id: "quarto-mundo", slug: "quarto-mundo", order: 3 },
  { id: "jazz-na-relva", slug: "jazz-na-relva", order: 4 },
  { id: "xapas-lounge", slug: "xapas-lounge", order: 5 },
];

describe("uniqueSortedDates", () => {
  it("dedupes and sorts chronologically", () => {
    const performances = [
      { id: "1", date: "2026-08-13", stageId: "vodafone" },
      { id: "2", date: "2026-08-09", stageId: "sobe-a-vila" },
      { id: "3", date: "2026-08-13", stageId: "palco2" },
    ];
    expect(uniqueSortedDates(performances)).toEqual(["2026-08-09", "2026-08-13"]);
  });
});

describe("performancesForDate", () => {
  it("filters to the given date only", () => {
    const performances = [
      { id: "1", date: "2026-08-13", stageId: "vodafone" },
      { id: "2", date: "2026-08-14", stageId: "vodafone" },
    ];
    expect(performancesForDate(performances, "2026-08-13")).toEqual([performances[0]]);
  });
});

describe("mainStages / otherStages", () => {
  it("splits a main day (two active stages) with nothing left over", () => {
    const performancesForDay = [
      { id: "1", date: "2026-08-13", stageId: "vodafone" },
      { id: "2", date: "2026-08-13", stageId: "palco2" },
    ];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["vodafone", "palco2"]);
    expect(otherStages(stages, performancesForDay)).toEqual([]);
  });

  it("puts a pre-festival day's single active stage in mainStages, not otherStages", () => {
    const performancesForDay = [{ id: "1", date: "2026-08-09", stageId: "sobe-a-vila" }];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["sobe-a-vila"]);
    expect(otherStages(stages, performancesForDay)).toEqual([]);
  });

  it("puts a third simultaneously-active stage in otherStages", () => {
    const performancesForDay = [
      { id: "1", date: "2026-08-13", stageId: "vodafone" },
      { id: "2", date: "2026-08-13", stageId: "palco2" },
      { id: "3", date: "2026-08-13", stageId: "sobe-a-vila" },
    ];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["vodafone", "palco2"]);
    expect(otherStages(stages, performancesForDay).map((s) => s.id)).toEqual(["sobe-a-vila"]);
  });

  it("ignores stages with no performances that day", () => {
    const performancesForDay = [{ id: "1", date: "2026-08-13", stageId: "vodafone" }];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["vodafone"]);
  });

  it("pairs Sobe à Vila + Xapas Lounge on a pre-festival evening, with Quarto Mundo stacked on top", () => {
    // Aug 10-11 shape: Quarto Mundo (daytime), Sobe à Vila + Xapas Lounge
    // (simultaneous evening). Quarto never joins the grid; the two evening
    // stages pair up even though Quarto's order sits between them.
    const performancesForDay = [
      { id: "1", date: "2026-08-10", stageId: "sobe-a-vila" },
      { id: "2", date: "2026-08-10", stageId: "quarto-mundo" },
      { id: "3", date: "2026-08-10", stageId: "xapas-lounge" },
    ];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["sobe-a-vila", "xapas-lounge"]);
    expect(otherStages(stages, performancesForDay).map((s) => s.id)).toEqual(["quarto-mundo"]);
  });

  it("keeps Quarto Mundo on its own on a two-stage day, never paired into the grid", () => {
    const performancesForDay = [
      { id: "1", date: "2026-08-10", stageId: "sobe-a-vila" },
      { id: "2", date: "2026-08-10", stageId: "quarto-mundo" },
    ];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["sobe-a-vila"]);
    expect(otherStages(stages, performancesForDay).map((s) => s.id)).toEqual(["quarto-mundo"]);
  });

  it("keeps Quarto Mundo, Jazz na Relva and Xapas Lounge stacked (Quarto on top) on a main day", () => {
    const performancesForDay = [
      { id: "1", date: "2026-08-13", stageId: "vodafone" },
      { id: "2", date: "2026-08-13", stageId: "palco2" },
      { id: "3", date: "2026-08-13", stageId: "quarto-mundo" },
      { id: "4", date: "2026-08-13", stageId: "jazz-na-relva" },
      { id: "5", date: "2026-08-13", stageId: "xapas-lounge" },
    ];
    expect(mainStages(stages, performancesForDay).map((s) => s.id)).toEqual(["vodafone", "palco2"]);
    expect(otherStages(stages, performancesForDay).map((s) => s.id)).toEqual([
      "quarto-mundo",
      "jazz-na-relva",
      "xapas-lounge",
    ]);
  });
});

describe("mainStages / otherStages with a three-column grid (London Calling)", () => {
  const lc = [
    { id: "small-hall", slug: "small-hall", order: 0 },
    { id: "main-hall", slug: "main-hall", order: 1 },
    { id: "de-kring", slug: "de-kring", order: 2 },
    { id: "barlaeus", slug: "barlaeus", order: 2 },
  ];
  const friday = [
    { id: "a", date: "2026-10-30", stageId: "small-hall" },
    { id: "b", date: "2026-10-30", stageId: "main-hall" },
    { id: "c", date: "2026-10-30", stageId: "de-kring" },
  ];

  it("puts all three active rooms in the grid and stacks nothing", () => {
    expect(mainStages(lc, friday, 3).map((s) => s.id)).toEqual(["small-hall", "main-hall", "de-kring"]);
    expect(otherStages(lc, friday, 3)).toEqual([]);
  });

  it("swaps the third column per night: Barlaeus on Saturday, De Kring dark", () => {
    const saturday = [
      { id: "d", date: "2026-10-31", stageId: "small-hall" },
      { id: "e", date: "2026-10-31", stageId: "main-hall" },
      { id: "f", date: "2026-10-31", stageId: "barlaeus" },
    ];
    expect(mainStages(lc, saturday, 3).map((s) => s.id)).toEqual(["small-hall", "main-hall", "barlaeus"]);
  });

  it("still defaults to two columns, stacking the third (Paredes de Coura's behaviour)", () => {
    expect(mainStages(lc, friday).map((s) => s.id)).toEqual(["small-hall", "main-hall"]);
    expect(otherStages(lc, friday).map((s) => s.id)).toEqual(["de-kring"]);
  });
});

describe("activeStagesSortedByOrder", () => {
  it("returns only stages with a set that day, in display order", () => {
    const stages = [
      { id: "b", slug: "b", order: 2 },
      { id: "a", slug: "a", order: 1 },
      { id: "dark", slug: "dark", order: 0 },
    ];
    const perfs = [
      { id: "p1", date: "2026-10-23", stageId: "a" },
      { id: "p2", date: "2026-10-23", stageId: "b" },
    ];
    expect(activeStagesSortedByOrder(stages, perfs).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("stagesByZone", () => {
  const zones = [
    { id: "z2", order: 1 },
    { id: "z1", order: 0 },
  ];
  const stages = [
    { id: "s3", slug: "s3", order: 0, zoneId: "z2" },
    { id: "s1", slug: "s1", order: 1, zoneId: "z1" },
    { id: "s2", slug: "s2", order: 0, zoneId: "z1" },
  ];

  it("groups by zone order, then stage order within each zone", () => {
    const groups = stagesByZone(stages, zones);
    expect(groups.map((g) => g.zone?.id)).toEqual(["z1", "z2"]);
    expect(groups[0].stages.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(groups[1].stages.map((s) => s.id)).toEqual(["s3"]);
  });

  // A day where a whole cluster is dark shouldn't leave a heading over nothing.
  it("drops zones with no stages", () => {
    const groups = stagesByZone([stages[1]], zones);
    expect(groups.map((g) => g.zone?.id)).toEqual(["z1"]);
  });

  // A stage must never vanish just because its zone is missing.
  it("collects unzoned stages into a trailing group rather than dropping them", () => {
    const withOrphan = [...stages, { id: "orphan", slug: "orphan", order: 9, zoneId: null }];
    const groups = stagesByZone(withOrphan, zones);
    expect(groups.at(-1)!.zone).toBeNull();
    expect(groups.at(-1)!.stages.map((s) => s.id)).toEqual(["orphan"]);
  });

  it("treats a stage pointing at an unknown zone as unzoned", () => {
    const groups = stagesByZone([{ id: "x", slug: "x", order: 0, zoneId: "gone" }], zones);
    expect(groups).toHaveLength(1);
    expect(groups[0].zone).toBeNull();
  });
});

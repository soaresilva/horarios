import { describe, expect, it } from "vitest";
import { mainStages, otherStages, performancesForDate, uniqueSortedDates } from "./grouping";

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

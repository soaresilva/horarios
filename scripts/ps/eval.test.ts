import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_SLOT_FIT, patternFit, scoreGuess, type PsHistory } from "./eval";
import type { PsSet, PsSnapshot } from "./plan";

const data = (file: string) => JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "data", file), "utf8"));
const snapshot = data("ps27.json") as PsSnapshot;
const history = data("ps-history.json") as PsHistory;

const set = (over: Partial<PsSet>): PsSet => ({
  day: "THU", stage: "cupra", name: "Friko", start: "18:50", end: "19:40", why: "x", ...over,
});

describe("patternFit", () => {
  it("passes the committed guess", () => {
    const fit = patternFit(snapshot.sets, history);
    expect(fit.failures).toEqual([]);
    expect(fit.slotFit).toBeGreaterThanOrEqual(MIN_SLOT_FIT);
  });

  it("only misses the closing set, which no past edition had", () => {
    expect(patternFit(snapshot.sets, history).misses).toEqual(["Skrillex b2b Ninajirachi (SAT revolut 03:00)"]);
  });

  it("fails a guess shifted two hours early", () => {
    const shifted = snapshot.sets.map((s) => ({
      ...s,
      start: `${String((Number(s.start.slice(0, 2)) + 22) % 24).padStart(2, "0")}${s.start.slice(2)}`,
    }));
    const fit = patternFit(shifted, history);
    expect(fit.slotFit).toBeLessThan(MIN_SLOT_FIT);
    expect(fit.failures).toContainEqual(expect.stringContaining("Slot fit"));
  });

  it("fails an overfilled stage", () => {
    const extra = Array.from({ length: 5 }, () => set({ stage: "port" }));
    expect(patternFit([...snapshot.sets, ...extra], history).failures).toContainEqual(expect.stringContaining("port THU"));
  });

  it("fails an empty stage", () => {
    const failures = patternFit(snapshot.sets.filter((s) => s.stage !== "revolut"), history).failures;
    expect(failures).toContainEqual(expect.stringContaining("revolut THU: 0 sets"));
  });

  it("fails set lengths that drift from past editions", () => {
    const short = snapshot.sets.map((s) => (s.stage === "port" ? { ...s, end: s.start } : s));
    expect(patternFit(short, history).failures).toContainEqual(expect.stringContaining("port: median"));
  });

  it("ignores the side stages, which have no history", () => {
    const moved = snapshot.sets.map((s) => (s.stage === "plenitude" ? { ...s, start: "12:00" } : s));
    expect(patternFit(moved, history).slotFit).toBe(patternFit(snapshot.sets, history).slotFit);
  });
});

describe("scoreGuess", () => {
  it("scores stage, stage size and timing separately", () => {
    const guess = [
      set({ name: "Friko", stage: "cupra", start: "18:50" }),
      set({ name: "Gilla Band", stage: "occident", start: "21:00" }),
      set({ name: "EAR", stage: "port", start: "23:00" }),
      set({ name: "Jersey", stage: "port", start: "23:00" }),
    ];
    const real = [
      { day: "THU" as const, stage: "cupra", name: "FRIKO", start: "19:30", end: "20:00" },
      { day: "THU" as const, stage: "cupra", name: "Gilla Band", start: "23:30", end: "00:30" },
      { day: "THU" as const, stage: "revolut", name: "EAR", start: "01:30", end: "02:30" },
    ];
    expect(scoreGuess(guess, real)).toEqual({
      matched: 3,
      unmatched: ["Jersey"],
      exactStage: 1 / 3,
      stageClass: 2 / 3,
      startWithinHour: 1 / 3,
    });
  });

  it("handles a real timetable it can't match at all", () => {
    expect(scoreGuess([set({})], []).exactStage).toBe(0);
  });

  it("keeps @ distinct, whose name has no letters to key on", () => {
    const guess = [set({ day: "FRI", name: "@", stage: "schwarzkopf" })];
    expect(scoreGuess(guess, [{ day: "FRI", stage: "schwarzkopf", name: "!", start: "18:00", end: "19:00" }]).matched).toBe(0);
    expect(scoreGuess(guess, [{ day: "FRI", stage: "schwarzkopf", name: "@", start: "18:00", end: "19:00" }]).matched).toBe(1);
  });
});

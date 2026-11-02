// The eval for the Primavera Sound 2027 guess. plan.ts says the snapshot is
// well-formed; this measures whether it's any good, first against the shape
// of past editions, and once the real timetable exists, against that. Pure
// and deterministic: the guess was made once by a model, the score isn't.
import { nameKey } from "../touo/plan";
import { clockMinutes, CORE_STAGES, MAIN_STAGES, MID_STAGES, SIDE_STAGES, SMALL_STAGES, type PsDay, type PsSet } from "./plan";

/** edition -> day -> stage -> "HH:MM-HH:MM" sets. */
export interface PsHistory {
  editions: Record<string, Partial<Record<PsDay, Record<string, string[]>>>>;
}

/** Thresholds a guess has to clear. Change them deliberately: they are the eval. */
export const SLOT_WINDOW_MINUTES = 30;
export const MIN_SLOT_FIT = 0.9;
export const SET_COUNT_SLACK = 1;
export const MAX_MEDIAN_DRIFT_MINUTES = 10;

export interface PatternFit {
  /** Share of sets on the seven stages starting near a past slot on that stage. */
  slotFit: number;
  misses: string[];
  /** Why the guess fails. Empty means it passes. */
  failures: string[];
}

const split = (range: string) => range.split("-") as [string, string];
const duration = (start: string, end: string) => clockMinutes(end) - clockMinutes(start);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function patternFit(sets: PsSet[], history: PsHistory): PatternFit {
  const days = Object.values(history.editions).flatMap((edition) => Object.values(edition));
  const past = (stage: string) => days.flatMap((day) => (day[stage] ? [day[stage]] : []));
  const failures: string[] = [];
  const misses: string[] = [];
  const core = sets.filter((s) => CORE_STAGES.includes(s.stage));

  for (const s of core) {
    const near = past(s.stage)
      .flat()
      .some((range) => Math.abs(clockMinutes(split(range)[0]) - clockMinutes(s.start)) <= SLOT_WINDOW_MINUTES);
    if (!near) misses.push(`${s.name} (${s.day} ${s.stage} ${s.start})`);
  }
  const slotFit = core.length ? (core.length - misses.length) / core.length : 0;
  if (slotFit < MIN_SLOT_FIT) failures.push(`Slot fit ${(slotFit * 100).toFixed(1)}% is under ${MIN_SLOT_FIT * 100}%.`);

  for (const stage of CORE_STAGES) {
    const counts = past(stage).map((list) => list.length);
    const low = Math.min(...counts) - SET_COUNT_SLACK;
    const high = Math.max(...counts) + SET_COUNT_SLACK;
    for (const day of ["THU", "FRI", "SAT"] as const) {
      const count = core.filter((s) => s.stage === stage && s.day === day).length;
      if (count < low || count > high) failures.push(`${stage} ${day}: ${count} sets, past editions held ${low + SET_COUNT_SLACK}-${high - SET_COUNT_SLACK}.`);
    }

    const before = median(past(stage).flat().map((range) => duration(...split(range))));
    const now = median(core.filter((s) => s.stage === stage).map((s) => duration(s.start, s.end)));
    if (Math.abs(before - now) > MAX_MEDIAN_DRIFT_MINUTES) {
      failures.push(`${stage}: median set ${now} min, past editions ${before} min.`);
    }
  }

  return { slotFit, misses, failures };
}

/** The real timetable, in the shape of ps27.json's sets, with real stage slugs. */
export type RealSet = Pick<PsSet, "day" | "stage" | "name" | "start" | "end">;

export interface GuessScore {
  matched: number;
  unmatched: string[];
  exactStage: number;
  stageClass: number;
  startWithinHour: number;
}

function stageClass(stage: string): string {
  if ((MAIN_STAGES as readonly string[]).includes(stage)) return "main";
  if ((MID_STAGES as readonly string[]).includes(stage)) return "mid";
  if ((SMALL_STAGES as readonly string[]).includes(stage)) return "small";
  if ((SIDE_STAGES as readonly string[]).includes(stage)) return "side";
  return stage;
}

const actKey = (s: Pick<PsSet, "day" | "name">) => `${s.day} ${s.name === "@" ? "@" : nameKey(s.name)}`;

/** How close the guess came, over every act that's in both timetables. */
export function scoreGuess(guess: PsSet[], real: RealSet[]): GuessScore {
  const actual = new Map(real.map((s) => [actKey(s), s]));
  const pairs = guess.flatMap((g) => {
    const r = actual.get(actKey(g));
    return r ? [[g, r] as const] : [];
  });
  const share = (hit: (g: PsSet, r: RealSet) => boolean) =>
    pairs.length ? pairs.filter(([g, r]) => hit(g, r)).length / pairs.length : 0;
  return {
    matched: pairs.length,
    unmatched: guess.filter((g) => !actual.has(actKey(g))).map((g) => g.name),
    exactStage: share((g, r) => g.stage === r.stage),
    stageClass: share((g, r) => stageClass(g.stage) === stageClass(r.stage)),
    startWithinHour: share((g, r) => Math.abs(clockMinutes(g.start) - clockMinutes(r.start)) <= 60),
  };
}

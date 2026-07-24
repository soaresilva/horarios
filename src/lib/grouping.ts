export interface StageLike {
  id: string;
  order: number;
}

export interface PerformanceLike {
  id: string;
  date: string;
  stageId: string;
}

/** All distinct festival-day labels present in the schedule, chronologically. */
export function uniqueSortedDates(performances: PerformanceLike[]): string[] {
  return [...new Set(performances.map((p) => p.date))].sort();
}

export function performancesForDate<T extends PerformanceLike>(performances: T[], date: string): T[] {
  return performances.filter((p) => p.date === date);
}

function activeStagesSortedByOrder<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  const activeStageIds = new Set(performancesForDay.map((p) => p.stageId));
  return stages.filter((s) => activeStageIds.has(s.id)).sort((a, b) => a.order - b.order);
}

/** The two lowest-`order` stages active on a given day render as the side-by-side grid. */
export function mainStages<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  return activeStagesSortedByOrder(stages, performancesForDay).slice(0, 2);
}

/** Any other stages active that day (e.g. a pre-festival or free-programme stage) go in the "other stages" tab. */
export function otherStages<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  return activeStagesSortedByOrder(stages, performancesForDay).slice(2);
}

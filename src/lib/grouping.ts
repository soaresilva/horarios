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

// Only stages with order at or below this can headline the two-column main
// grid (Vodafone 0, COURA 1, Sobe à Vila 2). Anything higher is a
// side-programme stage (Quarto Mundo, Jazz na Relva, Xapas Lounge) that
// always renders as its own stacked single-column section — even on a day
// where it's one of the only two active stages, so it never gets promoted
// into a side-by-side grid it wasn't meant for.
const MAIN_STAGE_MAX_ORDER = 2;

function activeStagesSortedByOrder<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  const activeStageIds = new Set(performancesForDay.map((p) => p.stageId));
  return stages.filter((s) => activeStageIds.has(s.id)).sort((a, b) => a.order - b.order);
}

/** The (up to two) lowest-`order` main-grid-eligible stages active on a day render as the side-by-side grid. */
export function mainStages<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  return activeStagesSortedByOrder(stages, performancesForDay)
    .filter((s) => s.order <= MAIN_STAGE_MAX_ORDER)
    .slice(0, 2);
}

/** Every other active stage (side-programme stages, plus any main-eligible ones past the first two) stacks as its own section. */
export function otherStages<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  const mainIds = new Set(mainStages(stages, performancesForDay).map((s) => s.id));
  return activeStagesSortedByOrder(stages, performancesForDay).filter((s) => !mainIds.has(s.id));
}

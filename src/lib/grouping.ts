export interface StageLike {
  id: string;
  slug: string;
  order: number;
}

export interface ZoneGroupable {
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

// Daytime stages that never join the two-column main grid — they always
// render as their own stacked single-column section, on top, whatever else is
// running. Quarto Mundo Sessions is an 11:00-15:00 daytime programme that
// doesn't overlap the evening stages, so pairing it into a shared-timeline
// grid just leaves big empty gaps. Every other stage is grid-eligible, so the
// two lowest-order active ones still pair up (Vodafone+Coura Sem Paredes on the main days,
// Sobe à Vila+Xapas Lounge on the pre-festival evenings).
const ALWAYS_STACKED_SLUGS = new Set<string>(["quarto-mundo"]);

/**
 * Stages with at least one set on the given day, in display order. The
 * transposed layout consumes this directly — a 26-room festival wants every
 * active room as a row, and rendering the ~14 rooms that are dark on a given
 * day would make the grid unreadable.
 */
export function activeStagesSortedByOrder<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  const activeStageIds = new Set(performancesForDay.map((p) => p.stageId));
  return stages.filter((s) => activeStageIds.has(s.id)).sort((a, b) => a.order - b.order);
}

/** The (up to two) lowest-`order` grid-eligible stages active on a day render as the side-by-side grid. */
export function mainStages<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  return activeStagesSortedByOrder(stages, performancesForDay)
    .filter((s) => !ALWAYS_STACKED_SLUGS.has(s.slug))
    .slice(0, 2);
}

/** Every other active stage (always-stacked daytime stages, plus any grid-eligible ones past the first two) stacks as its own section, ordered by `order`. */
export function otherStages<S extends StageLike>(stages: S[], performancesForDay: PerformanceLike[]): S[] {
  const mainIds = new Set(mainStages(stages, performancesForDay).map((s) => s.id));
  return activeStagesSortedByOrder(stages, performancesForDay).filter((s) => !mainIds.has(s.id));
}

/**
 * Stages bucketed into their walking zones, zones in `order`, stages in
 * `order` within each. Zones with no active stage are dropped so a day where
 * a whole cluster is dark doesn't leave an empty heading; any stage without a
 * zone collects in a trailing `zone: null` group rather than disappearing.
 */
export function stagesByZone<S extends StageLike & { zoneId: string | null }, Z extends ZoneGroupable>(
  stages: S[],
  zones: Z[],
): { zone: Z | null; stages: S[] }[] {
  const groups: { zone: Z | null; stages: S[] }[] = [];

  for (const zone of [...zones].sort((a, b) => a.order - b.order)) {
    const members = stages.filter((s) => s.zoneId === zone.id).sort((a, b) => a.order - b.order);
    if (members.length > 0) groups.push({ zone, stages: members });
  }

  const zoneIds = new Set(zones.map((z) => z.id));
  const unzoned = stages
    .filter((s) => !s.zoneId || !zoneIds.has(s.zoneId))
    .sort((a, b) => a.order - b.order);
  if (unzoned.length > 0) groups.push({ zone: null, stages: unzoned });

  return groups;
}

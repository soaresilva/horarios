export interface ZoneLike {
  id: string;
  name: string;
  order: number;
  walkMinutesFromHub: number | null;
}

export interface ZoneWalkLike {
  fromZoneId: string;
  toZoneId: string;
  minutes: number;
}

/**
 * Approximate walking minutes between two zones, or null if the pair was
 * never measured. Walks are stored once per unordered pair, so this checks
 * both directions rather than making callers know which way it was written.
 */
export function walkMinutesBetween(
  walks: ZoneWalkLike[],
  fromZoneId: string | null | undefined,
  toZoneId: string | null | undefined,
): number | null {
  if (!fromZoneId || !toZoneId) return null;
  if (fromZoneId === toZoneId) return 0;
  const match = walks.find(
    (w) =>
      (w.fromZoneId === fromZoneId && w.toZoneId === toZoneId) ||
      (w.fromZoneId === toZoneId && w.toZoneId === fromZoneId),
  );
  return match ? match.minutes : null;
}

export interface WalkSegment {
  sameStage: boolean;
  /** Minutes between the two stages' zones, or null when that pair was never measured (e.g. PdC, which has no zones at all). */
  minutes: number | null;
}

/**
 * The walk between two consecutive shows in a favorites list: same venue,
 * a measured zone-to-zone distance, or nothing honest to show. Stays a thin
 * wrapper over walkMinutesBetween rather than a second lookup, so the two
 * never drift on what "no data" means.
 */
export function walkSegmentBetweenStages<S extends { id: string; zoneId: string | null }>(
  walks: ZoneWalkLike[],
  fromStage: S,
  toStage: S,
): WalkSegment {
  if (fromStage.id === toStage.id) return { sameStage: true, minutes: 0 };
  return { sameStage: false, minutes: walkMinutesBetween(walks, fromStage.zoneId, toStage.zoneId) };
}

/**
 * How a zone's walking distance reads on the timetable. With no origin
 * chosen it's the distance from the festival hub; once a visitor taps a set,
 * it becomes the distance from *that* venue, which is the only number that
 * answers "can I get there from where I'll be".
 *
 * Returns null when there's nothing honest to show, so the caller renders
 * nothing rather than a misleading zero.
 */
export function zoneWalkLabel(
  zone: ZoneLike,
  walks: ZoneWalkLike[],
  originZoneId: string | null,
  originZoneName: string | null,
): string | null {
  if (!originZoneId) {
    return zone.walkMinutesFromHub === null ? null : `${zone.walkMinutesFromHub} min from ticket desk`;
  }
  const minutes = walkMinutesBetween(walks, originZoneId, zone.id);
  if (minutes === null) return null;
  if (minutes === 0) return "you are here";
  return `${minutes} min from ${originZoneName ?? "here"}`;
}

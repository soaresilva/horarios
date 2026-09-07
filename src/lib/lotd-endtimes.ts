// Left of the Dial publishes only start times. Its 2025 printed timetable
// shows sets running ~30 minutes with real gaps between them in the same room
// (Annabel Down, Thursday: 19:00, 20:20, 21:50, 23:20), so "runs until the
// next act" — the rule Paredes de Coura uses — would stretch a 30-minute
// showcase into an 80-minute block and send someone to a room that emptied
// an hour ago.
//
// Instead: 40 minutes, clipped so a set never overruns the next one in the
// same room. The clip only bites where the festival has booked back-to-back.
export const DEFAULT_SET_MINUTES = 40;

const MINUTE_MS = 60_000;

export interface DatedSet {
  stageSlug: string;
  startTime: Date;
}

export interface TimedSet extends DatedSet {
  endTime: Date;
}

export interface EndTimeWarning {
  stageSlug: string;
  startTime: Date;
  message: string;
}

export interface EndTimeResult<T extends DatedSet> {
  sets: (T & { endTime: Date })[];
  warnings: EndTimeWarning[];
}

/**
 * Fill in an end time for every set.
 *
 * Grouped by room and sorted by *instant*, not by festival-day label: a 23:50
 * set and the 00:20 that follows it are adjacent in real time even though
 * they may carry different day labels. Grouping across the whole festival
 * rather than per day is also what stops the last set of one night being
 * clipped by the first set of the next — that gap is ~15 hours, so the
 * 40-minute cap always wins.
 */
export function withDerivedEndTimes<T extends DatedSet>(sets: T[]): EndTimeResult<T> {
  const byStage = new Map<string, T[]>();
  for (const set of sets) {
    const group = byStage.get(set.stageSlug);
    if (group) group.push(set);
    else byStage.set(set.stageSlug, [set]);
  }

  const out: (T & { endTime: Date })[] = [];
  const warnings: EndTimeWarning[] = [];

  for (const [stageSlug, group] of byStage) {
    const sorted = [...group].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    sorted.forEach((set, i) => {
      const capped = new Date(set.startTime.getTime() + DEFAULT_SET_MINUTES * MINUTE_MS);

      // Clip against the next set that starts *later*, not merely the next in
      // the list. The source really does list two acts in one room at one
      // time (Trip Westerns and TURNSPIT, twice), and clipping against an
      // identical start would collapse the block to zero width.
      const next = sorted.slice(i + 1).find((s) => s.startTime.getTime() > set.startTime.getTime());

      if (sorted[i + 1]?.startTime.getTime() === set.startTime.getTime()) {
        warnings.push({
          stageSlug,
          startTime: set.startTime,
          message: "two sets start at the same time in this room — both are shown, overlapping",
        });
      }

      if (!next) {
        out.push({ ...set, endTime: capped });
        return;
      }

      const gapMinutes = (next.startTime.getTime() - set.startTime.getTime()) / MINUTE_MS;
      if (gapMinutes < 10) {
        warnings.push({
          stageSlug,
          startTime: set.startTime,
          message: `only ${gapMinutes} min before the next set — check the source`,
        });
      }

      out.push({ ...set, endTime: next.startTime < capped ? next.startTime : capped });
    });
  }

  return { sets: out, warnings };
}

import { z } from "zod";
import { fromFestivalDayTime, toLisbonClockValue } from "@/lib/time";

// One "HH:MM" time picker per start/end plus a festival-day label, resolved
// into instants via fromFestivalDayTime. Notes and the recommended checkbox
// are optional; an unchecked box submits nothing.
export const RowInput = z.object({
  artistName: z.string().trim().min(1, "artist name is required"),
  stageId: z.string().min(1, "a stage is required"),
  date: z.string().min(1, "a festival day is required"),
  start: z.string().min(1, "a start time is required"),
  end: z.string().min(1, "an end time is required"),
  notes: z.string().optional(),
  recommended: z.boolean(),
});

export type RawPerformanceRow = z.input<typeof RowInput>;

// The subset of a stored Performance row this module needs, to decide
// whether a submitted row is unchanged and to reuse its instants when it is.
export interface StoredPerformance {
  artistName: string;
  stageId: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  recommended: boolean;
}

export interface PerformanceData {
  artistName: string;
  stageId: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  recommended: boolean;
}

// Whether a row's date/start/end round-trip exactly to what's already
// stored. Used to decide whether it's safe to keep the existing startTime/
// endTime instants as-is instead of re-deriving them from the submitted
// "HH:MM" strings via fromFestivalDayTime.
export function timeFieldsUnchanged(
  raw: { date: string; start: string; end: string },
  current: StoredPerformance,
): boolean {
  return (
    raw.date === current.date.toISOString().slice(0, 10) &&
    raw.start === toLisbonClockValue(current.startTime) &&
    raw.end === toLisbonClockValue(current.endTime)
  );
}

// Whether every field of a row is unchanged from what's already stored, so
// the save can skip it entirely (no Prisma op, no validation).
export function rowUnchanged(raw: RawPerformanceRow, current: StoredPerformance): boolean {
  return (
    raw.artistName.trim() === current.artistName &&
    raw.stageId === current.stageId &&
    (raw.notes ?? "") === (current.notes ?? "") &&
    raw.recommended === current.recommended &&
    timeFieldsUnchanged(raw, current)
  );
}

// Validate one row into a create/update `data` object, or return an error
// string tagged with the artist name so the admin knows which row.
//
// `current`, when given, is the row's presently-stored DB state. If the
// submitted date/start/end round-trip exactly to it, the existing startTime/
// endTime instants are reused verbatim instead of being re-derived from the
// "HH:MM" strings — fromFestivalDayTime's roll-past-midnight heuristic
// (FESTIVAL_DAY_ROLL_HOUR in src/lib/time.ts) can't reconstruct a handful of
// rows whose actual instant doesn't follow it (e.g. 16 Aug's Dupplo set,
// 04:20-06:15, seeded via a literal timestamp in a data migration precisely
// because the heuristic can't express it — see the comment on
// FESTIVAL_DAY_ROLL_HOUR). Without this, saving *any* change on the admin
// panel would re-derive every existing row's times from its prefilled HH:MM
// inputs, and Dupplo's would always fail the end-after-start check below,
// blocking the whole save even though its own row was never touched.
export function buildPerformanceData(
  raw: RawPerformanceRow,
  current?: StoredPerformance,
): { data: PerformanceData } | { error: string } {
  const parsed = RowInput.safeParse(raw);
  const label = raw.artistName.trim() || "New performance";
  if (!parsed.success) {
    return { error: `${label}: ${parsed.error.issues[0]?.message ?? "invalid input"}` };
  }

  const { artistName, stageId, date, start, end, notes, recommended } = parsed.data;

  let startTime: Date;
  let endTime: Date;
  if (current && timeFieldsUnchanged(parsed.data, current)) {
    startTime = current.startTime;
    endTime = current.endTime;
  } else {
    startTime = fromFestivalDayTime(date, start);
    endTime = fromFestivalDayTime(date, end);
    if (endTime.getTime() <= startTime.getTime()) {
      return { error: `${label}: end time must be after start time.` };
    }
  }

  return {
    data: {
      artistName,
      stageId,
      date: new Date(`${date}T00:00:00Z`),
      startTime,
      endTime,
      notes: notes || null,
      recommended,
    },
  };
}

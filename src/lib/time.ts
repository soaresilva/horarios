// Paredes de Coura runs in mainland Portugal (WEST, UTC+1 in August).
// All display formatting is pinned to this timezone so set times read
// correctly regardless of the viewer's device timezone.
export const FESTIVAL_TIMEZONE = "Europe/Lisbon";

// How minutes become pixels, and the floor below which a block stops being
// readable. The two layouts need different densities because they spend the
// axis differently: the vertical grid has a whole column width for the
// artist name and only needs height for two lines, while the transposed grid
// has a fixed 56px row height and must fit the name along the *time* axis,
// so a short set needs far more pixels per minute to stay legible.
export interface GridScale {
  pxPerMinute: number;
  /** Minimum size along the time axis: height when vertical, width when transposed. */
  minExtent: number;
}

// A 45-minute set (the shortest slot in the seeded PdC schedule) renders at
// 90px tall — room for an artist name and the set times on mobile.
export const VERTICAL_SCALE: GridScale = { pxPerMinute: 2, minExtent: 40 };

// A 40-minute set renders 160px wide and a clipped 30-minute one 120px, both
// wide enough for a two-line artist name. A 15:00–00:40 festival day comes
// out ~2320px, roughly six screen-widths on a 390px phone — enough to feel
// the shape of the evening without endless swiping.
export const HORIZONTAL_SCALE: GridScale = { pxPerMinute: 4, minExtent: 120 };

// Kept as named exports: the vertical layout and its tests read these
// directly, and they are what every existing import expects.
export const PX_PER_MINUTE = VERTICAL_SCALE.pxPerMinute;

export const MIN_BLOCK_HEIGHT = VERTICAL_SCALE.minExtent;

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

export interface GridWindow {
  start: Date;
  end: Date;
}

// The active festival day doesn't roll forward at Lisbon midnight — sets
// commonly run past it (latest end ~04:40, one outlier at 06:15). 8am gives
// a solid margin past that so the previous evening's tab stays active
// through the small hours instead of jumping to an empty "tomorrow" while
// the show (or the visitor reviewing it) is still going. Deliberately a
// separate constant from FESTIVAL_DAY_ROLL_HOUR below, which answers a
// different question (which calendar day a performance's own clock time
// belongs to), not "which day is active right now".
const ACTIVE_DAY_ROLLOVER_HOUR = 8;

/**
 * The active festival day as YYYY-MM-DD, for matching against performance
 * `date` labels. Doesn't roll to the next calendar day at Lisbon midnight —
 * only once it's past ACTIVE_DAY_ROLLOVER_HOUR (8am) Lisbon time, since the
 * programme regularly runs into the small hours.
 */
export function todayInFestivalTimezone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FESTIVAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23", // force 00-23; hourCycle "h24" (a possible ICU default) reports midnight as "24"
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dateLabel = `${get("year")}-${get("month")}-${get("day")}`;
  if (Number(get("hour")) < ACTIVE_DAY_ROLLOVER_HOUR) {
    const rolledBack = new Date(`${dateLabel}T00:00:00Z`);
    rolledBack.setUTCDate(rolledBack.getUTCDate() - 1);
    return rolledBack.toISOString().slice(0, 10);
  }
  return dateLabel;
}

/**
 * For `<input type="datetime-local">` in the admin panel. The admin always
 * edits in Lisbon wall-clock time (not their own browser's timezone), which
 * matches how every other time in this app is anchored, and Portugal is
 * fixed at WEST (UTC+1) for the whole festival window, so the offset is a
 * constant rather than something that needs DST-aware lookup.
 */
export function toLisbonDatetimeLocalValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FESTIVAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromLisbonDatetimeLocalValue(value: string): Date {
  return new Date(`${value}:00+01:00`);
}

// Boundary hour between "the small hours of the next calendar day" (rolls)
// and "the same calendar day" (doesn't). It sits inside the daily gap in the
// programme — nothing is scheduled 05:00–15:00 — and is safely clear of the
// ~04:40 latest set end. Set at 06:00 rather than up at 13:00 so the admin
// can enter an early-afternoon slot (e.g. 12:30) without it silently rolling
// onto the next day. Must stay in [05:00, 15:00) for real sets to resolve
// correctly; `prisma/seed.ts` uses the same boundary.
//
// One known exception: 16 Aug's Dupplo set (04:20-06:15) straddles this
// boundary mid-act, so re-deriving its start time through this heuristic
// rolls 04:20 onto the 17th while leaving 06:15 on the 16th, which would
// fail the "end time must be after start time" check in actions.ts. That
// row's DB values were set directly via a data migration instead of through
// this heuristic. actions.ts's buildPerformanceData() reuses a row's
// existing startTime/endTime whenever the submitted date/start/end
// round-trip to what's already stored, so this only bites if the admin
// actually edits Dupplo's own start or end time in /admin — it no longer
// blocks saving unrelated rows. Not fixing the boundary itself for this one
// bonus-day edge case.
const FESTIVAL_DAY_ROLL_HOUR = 6;

/**
 * Whether an "HH:MM" clock time belongs to the calendar day *after* its
 * festival-day label — i.e. it falls in the small hours following that
 * evening. Paredes de Coura's programme runs mid-afternoon into the small
 * hours (earliest ~15:00, latest ~04:40), so a time before 06:00 means
 * "after midnight, next day"; 06:00 onward is the same calendar day.
 */
export function festivalTimeRolls(hhmm: string): boolean {
  return Number(hhmm.split(":")[0]) < FESTIVAL_DAY_ROLL_HOUR;
}

/**
 * Resolve a festival-day label ("YYYY-MM-DD") plus an "HH:MM" Lisbon
 * wall-clock time into a real UTC instant, rolling past-midnight times onto
 * the next calendar day. Portugal is fixed at WEST (UTC+1) for the whole
 * August festival window, so the offset is a constant (matches seed.ts).
 */
export function fromFestivalDayTime(dayISO: string, hhmm: string): Date {
  const base = new Date(`${dayISO}T${hhmm}:00+01:00`);
  if (festivalTimeRolls(hhmm)) {
    base.setUTCDate(base.getUTCDate() + 1);
  }
  return base;
}

/** "HH:MM" Lisbon wall-clock time of an instant, for pre-filling the admin time pickers. */
export function toLisbonClockValue(date: Date): string {
  return toLisbonDatetimeLocalValue(date).slice(11);
}

export function formatClock(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: FESTIVAL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Portuguese weekday abbreviations, matching the reference bolachas.org
// timetable's "QUA 13" / "QUI 14" style. Keyed off the en-US short weekday
// (always a stable 3-letter code across ICU builds) rather than pt-PT's
// "short" form, which some environments render as a full word.
const WEEKDAY_PT: Record<string, string> = {
  Sun: "DOM",
  Mon: "SEG",
  Tue: "TER",
  Wed: "QUA",
  Thu: "QUI",
  Fri: "SEX",
  Sat: "SÁB",
};

export function formatDayTabLabel(date: Date): { weekday: string; day: string } {
  const enWeekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: FESTIVAL_TIMEZONE,
  }).format(date);
  const day = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    timeZone: FESTIVAL_TIMEZONE,
  }).format(date);
  return { weekday: WEEKDAY_PT[enWeekday] ?? enWeekday.toUpperCase(), day };
}

const HOUR_ROUND_MS = 60 * 60 * 1000;

/**
 * The visible grid window for a day is derived from its performances
 * (earliest start floored to the hour, latest end ceiled to the hour)
 * rather than a hardcoded 16:00-04:30 range, so admin-added early/late
 * slots always fit without a code change.
 */
export function computeDayWindow(performances: TimeRange[]): GridWindow | null {
  if (performances.length === 0) return null;

  let minStart = performances[0].startTime.getTime();
  let maxEnd = performances[0].endTime.getTime();
  for (const p of performances) {
    minStart = Math.min(minStart, p.startTime.getTime());
    maxEnd = Math.max(maxEnd, p.endTime.getTime());
  }

  const start = new Date(Math.floor(minStart / HOUR_ROUND_MS) * HOUR_ROUND_MS);
  const end = new Date(Math.ceil(maxEnd / HOUR_ROUND_MS) * HOUR_ROUND_MS);
  return { start, end };
}

export function minutesFromWindowStart(window: GridWindow, date: Date): number {
  return (date.getTime() - window.start.getTime()) / 60000;
}

/** Total size of a day's window along the time axis. */
export function windowExtent(window: GridWindow, scale: GridScale = VERTICAL_SCALE): number {
  return minutesFromWindowStart(window, window.end) * scale.pxPerMinute;
}

// Deliberately axis-neutral names rather than {top, height}: the same math
// drives `top`/`height` in the vertical grid and `left`/`width` in the
// transposed one, and naming it after one of them hides that.
export interface BlockLayout {
  /** Distance from the window start along the time axis. */
  offset: number;
  /** Size along the time axis. */
  extent: number;
}

export function blockLayout(
  window: GridWindow,
  range: TimeRange,
  scale: GridScale = VERTICAL_SCALE,
): BlockLayout {
  const offset = minutesFromWindowStart(window, range.startTime) * scale.pxPerMinute;
  const rawExtent =
    ((range.endTime.getTime() - range.startTime.getTime()) / 60000) * scale.pxPerMinute;
  return { offset, extent: Math.max(rawExtent, scale.minExtent) };
}

/** Offset in px of the "now" marker within the window, or null if now falls outside it. */
export function currentTimeOffset(
  window: GridWindow,
  now: Date,
  scale: GridScale = VERTICAL_SCALE,
): number | null {
  if (now.getTime() < window.start.getTime() || now.getTime() > window.end.getTime()) {
    return null;
  }
  return minutesFromWindowStart(window, now) * scale.pxPerMinute;
}

export interface TimeTick {
  offset: number;
  label: string;
  isHour: boolean;
  /** Minutes from the window start, so a caller can label a subset of ticks. */
  minutes: number;
}

/**
 * Gridlines every `stepMinutes`. The vertical axis labels all of them and
 * dims the off-hour ones; the transposed axis draws ticks every 10 minutes
 * but labels only every 30, since horizontal labels sit side by side and
 * would otherwise collide — hence `minutes` on each tick.
 */
export function generateTimeTicks(
  window: GridWindow,
  stepMinutes = 30,
  scale: GridScale = VERTICAL_SCALE,
): TimeTick[] {
  const ticks: TimeTick[] = [];
  const totalMinutes = minutesFromWindowStart(window, window.end);
  for (let m = 0; m <= totalMinutes; m += stepMinutes) {
    const tickDate = new Date(window.start.getTime() + m * 60000);
    ticks.push({
      offset: m * scale.pxPerMinute,
      label: formatClock(tickDate),
      isHour: tickDate.getUTCMinutes() === 0,
      minutes: m,
    });
  }
  return ticks;
}

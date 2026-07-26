// Paredes de Coura runs in mainland Portugal (WEST, UTC+1 in August).
// All display formatting is pinned to this timezone so set times read
// correctly regardless of the viewer's device timezone.
export const FESTIVAL_TIMEZONE = "Europe/Lisbon";

// Pixels per minute for the timetable grid. At this density a 45-minute
// set (the shortest slot in the seeded schedule) renders at 90px, tall
// enough to fit an artist name and start time comfortably on mobile.
export const PX_PER_MINUTE = 2;

export const MIN_BLOCK_HEIGHT = 40;

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

export interface GridWindow {
  start: Date;
  end: Date;
}

/** Today's date as YYYY-MM-DD in the festival timezone, for matching against performance `date` labels. */
export function todayInFestivalTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FESTIVAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
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

/**
 * Whether an "HH:MM" clock time belongs to the calendar day *after* its
 * festival-day label. Paredes de Coura's programme runs mid-afternoon into
 * the small hours (earliest ~15:00, latest ~04:40, nothing in between), so a
 * time before 13:00 unambiguously means "after midnight, next day". Same rule
 * `prisma/seed.ts` uses to place its seeded acts — kept identical here so the
 * admin panel's festival-day + time inputs resolve to the same instants.
 */
export function festivalTimeRolls(hhmm: string): boolean {
  return Number(hhmm.split(":")[0]) < 13;
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

export function windowHeight(window: GridWindow): number {
  return minutesFromWindowStart(window, window.end) * PX_PER_MINUTE;
}

export interface BlockLayout {
  top: number;
  height: number;
}

export function blockLayout(window: GridWindow, range: TimeRange): BlockLayout {
  const top = minutesFromWindowStart(window, range.startTime) * PX_PER_MINUTE;
  const rawHeight =
    ((range.endTime.getTime() - range.startTime.getTime()) / 60000) * PX_PER_MINUTE;
  return { top, height: Math.max(rawHeight, MIN_BLOCK_HEIGHT) };
}

/** Offset in px of the "now" line within the window, or null if now falls outside it. */
export function currentTimeOffset(window: GridWindow, now: Date): number | null {
  if (now.getTime() < window.start.getTime() || now.getTime() > window.end.getTime()) {
    return null;
  }
  return minutesFromWindowStart(window, now) * PX_PER_MINUTE;
}

export interface TimeTick {
  offset: number;
  label: string;
  isHour: boolean;
}

/** Gridlines every `stepMinutes`, labeled on the hour to avoid clutter on mobile. */
export function generateTimeTicks(window: GridWindow, stepMinutes = 30): TimeTick[] {
  const ticks: TimeTick[] = [];
  const totalMinutes = minutesFromWindowStart(window, window.end);
  for (let m = 0; m <= totalMinutes; m += stepMinutes) {
    const tickDate = new Date(window.start.getTime() + m * 60000);
    ticks.push({
      offset: m * PX_PER_MINUTE,
      label: formatClock(tickDate),
      isHour: tickDate.getUTCMinutes() % 60 === 0,
    });
  }
  return ticks;
}

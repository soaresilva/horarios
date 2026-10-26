// A festival reads as archived once its programme has fully wrapped, rather
// than via a stored flag someone has to remember to flip — see the
// comment on the Festival model in schema.prisma. `endDate` is a plain
// calendar-date label (UTC midnight, no timezone), so a full day of grace is
// added before treating it as over.
export function isFestivalOver(endDate: Date, now: Date = new Date()): boolean {
  return endDate.getTime() + 24 * 60 * 60 * 1000 < now.getTime();
}

// `startDate`/`endDate` are calendar-date labels (@db.Date, stored as UTC
// midnight), not real instants in the festival's own timezone — same
// convention as Performance.date. Format them in UTC, not the festival's
// timezone, so a festival west of UTC never displays one day early.
export function formatFestivalDateRange(startDate: Date, endDate: Date): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" }).format(d);
  const month = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(d);
  const year = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", year: "numeric" }).format(d);

  const sameMonth = month(startDate) === month(endDate) && year(startDate) === year(endDate);
  if (sameMonth) {
    return `${day(startDate)}–${day(endDate)} ${month(endDate)} ${year(endDate)}`;
  }
  return `${day(startDate)} ${month(startDate)} – ${day(endDate)} ${month(endDate)} ${year(endDate)}`;
}

// The festival `/` redirects to, or undefined when none is featured and the
// archive list should render instead. The DB allows only one, but if data
// ever disagrees the most recent edition wins (input order is startDate desc).
export function pickFeatured<T extends { featured: boolean }>(festivals: T[]): T | undefined {
  return festivals.find((f) => f.featured);
}

// Venue strings exactly as they appear on the act pages, mapped to the Stage
// slugs created by the 20260907073000_add_lotd26_festival migration.
//
// The importer deliberately cannot create a Stage: rooms carry hand-curated
// zone membership and street addresses, so inventing one from a string would
// produce a room with no location and no walking distances. An unmapped venue
// therefore fails the run loudly — that failure is the signal that the
// festival added or renamed a room and this map needs a line.
export const VENUE_TO_STAGE_SLUG: Record<string, string> = {
  "ANNABEL DOWN": "annabel-down",
  "ANNABEL UP": "annabel-up",
  "ARMINIUS DOWN": "arminius-down",
  "ARMINIUS UP": "arminius-up",
  BAANHOF: "baanhof",
  BARRIO: "barrio",
  BIRD: "bird",
  "DE DOELEN UP": "de-doelen-up",
  "DE DOELEN WBH": "de-doelen-wbh",
  MONO: "mono",
  PARADIJSKERK: "paradijskerk",
  REIJNGOUD: "reijngoud",
  REMASTERED: "remastered",
  ROTOWN: "rotown",
  SAHARA: "sahara",
  SALSABILITY: "salsability",
  STALLES: "stalles",
  "STALLES (FKA CENTRAAL)": "stalles",
  "TR DOWN": "tr-down",
  "TR FOYER": "tr-foyer",
  "TR UP": "tr-up",
  UNIEK: "uniek",
  V11: "v11",
  V2_: "v2",
  "WAALSE KERK": "waalse-kerk",
  "WORM 1": "worm-1",
  "WORM 2": "worm-2",
};

// Festival-day labels. The festival runs Wed 21 - Sat 24 October 2026.
export const DAY_TO_DATE: Record<string, string> = {
  WEDNESDAY: "2026-10-21",
  THURSDAY: "2026-10-22",
  FRIDAY: "2026-10-23",
  SATURDAY: "2026-10-24",
};

export function stageSlugForVenue(venue: string): string {
  const slug = VENUE_TO_STAGE_SLUG[venue.trim().toUpperCase()];
  if (!slug) {
    throw new Error(
      `Unknown venue "${venue}". Add it to VENUE_TO_STAGE_SLUG in scripts/lotd/venues.ts, ` +
        `and add the room itself (with its zone and address) in a migration first.`,
    );
  }
  return slug;
}

export function dateForDay(day: string): string {
  const date = DAY_TO_DATE[day.trim().toUpperCase()];
  if (!date) throw new Error(`Unknown festival day "${day}".`);
  return date;
}

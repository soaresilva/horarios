// Venue labels exactly as scripts/touo/extract-pdf.py reads them off the
// TOUO timetable, mapped to lotd26 Stage slugs. Same rule as
// scripts/lotd/venues.ts: the importer never invents a room, so an unknown
// label fails the run and the room goes into a migration first
// (20261016120000_add_touo_side_programme added the four TOUO-only ones).
export const TOUO_VENUE_TO_STAGE_SLUG: Record<string, string> = {
  // The PDF says only "ARMINIUS, hosted by 3voor12" and doesn't name the
  // room. Arminius Down is the main hall LOTD uses for its bigger daytime
  // crowd, so that's the assumption; move these three sets if the TOUO app
  // says Up.
  ARMINIUS: "arminius-down",
  "BREWPUB REIJNGOUD": "reijngoud",
  MONO: "mono",
  PLATO: "plato",
  ROTOWN: "rotown",
  SALSABILITY: "salsability",
  "STALLES (FKA CENTRAAL)": "stalles",
  "TIME IS THE NEW SPACE": "time-new-space",
  TRAMHUIS: "tramhuis",
  "TR DOWN": "tr-down",
  "TR FOYER": "tr-foyer",
  UNIEK: "uniek",
  V11: "v11",
  "ZONDEBOK EN ZWARTE SCHAAP": "zondebok",
};

export function touoStageSlug(venue: string): string {
  const slug = TOUO_VENUE_TO_STAGE_SLUG[venue.trim().toUpperCase()];
  if (!slug) {
    throw new Error(
      `Unknown TOUO venue "${venue}". Add it to TOUO_VENUE_TO_STAGE_SLUG in scripts/touo/venues.ts, ` +
        `and add the room itself (with its zone and address) in a migration first.`,
    );
  }
  return slug;
}

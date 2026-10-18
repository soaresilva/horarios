// The committed snapshot shape (scripts/data/lgw26.json): what --fetch
// writes and every other command reads. Kept separate from parse.ts so tests
// can build one without touching the Livewire shapes.
import type { RawShow, SourceProject } from "./parse";
import type { VenueFacts } from "./venue-page";

export interface LgwSnapshot {
  source: string[];
  fetchedAt: string;
  /** Day tabs per programme, as the site offers them. */
  days: { LGW: string[]; "U?": string[] };
  /** Both programmes' project lists, merged by id. */
  projects: SourceProject[];
  shows: RawShow[];
  /** Keyed by source venue name ("TivoliVredenburg", "dB's"); null when the venue has no page. */
  venues: Record<string, VenueFacts | null>;
}

/** Source venue name -> its /about/venues/<slug> page, where slugifying the name gets it wrong. */
export const VENUE_PAGE_SLUG_OVERRIDES: Record<string, string> = {
  "dB's": "dbs",
  "Stadsschouwburg": "stadsschouwburg-utrecht",
  // A cabin on De Nijverheid's quay; the Analogue Photobooth page links it
  // to De Nijverheid's venue page.
  "Stuurhut": "de-nijverheid",
};

export function venuePageSlug(venue: string): string {
  return (
    VENUE_PAGE_SLUG_OVERRIDES[venue] ??
    venue
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/['’.]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

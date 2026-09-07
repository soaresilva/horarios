// Wire format for GET /api/festivals/<slug>/schedule. Dates are ISO strings
// (not Date objects) since this crosses the network/service-worker-cache
// boundary; callers parse them back into Date instances client-side.
//
// Festival scalars that never change for an edition (layout, timezone,
// locale, name) deliberately do NOT live here — they come straight from the
// Festival row as server-component props, so the right layout renders on the
// first paint instead of flashing after a fetch.

export interface ZoneDTO {
  id: string;
  name: string;
  order: number;
  /** Approximate walking minutes from the festival hub, if measured. */
  walkMinutesFromHub: number | null;
}

export interface ZoneWalkDTO {
  fromZoneId: string;
  toZoneId: string;
  minutes: number;
}

export interface ArtistDTO {
  id: string;
  name: string;
  country: string | null;
  genres: string | null;
  spotifyUrl: string | null;
  instagramUrl: string | null;
  /** The act's page on the festival's own site, linked from its name. */
  sourceUrl: string | null;
}

export interface StageDTO {
  id: string;
  name: string;
  slug: string;
  order: number;
  /** Which walking cluster this room is in; null for single-site festivals. */
  zoneId: string | null;
  /** Street address, used to build a maps link from the venue name. */
  address: string | null;
}

export interface PerformanceDTO {
  id: string;
  artistName: string;
  /** Festival-day label (YYYY-MM-DD), not necessarily the calendar date of startTime for sets that roll past midnight. */
  date: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  /** Admin-curated "bolachas recommends" flag. Independent of a viewer's own starred favourites. */
  recommended: boolean;
  stageId: string;
  /** Link to imported reference data; null for festivals with no Artist rows. */
  artistId: string | null;
}

export interface ScheduleResponse {
  updatedAt: string;
  zones: ZoneDTO[];
  zoneWalks: ZoneWalkDTO[];
  stages: StageDTO[];
  artists: ArtistDTO[];
  performances: PerformanceDTO[];
}

// Wire format for GET /api/schedule. Dates are ISO strings (not Date
// objects) since this crosses the network/service-worker-cache boundary;
// callers parse them back into Date instances client-side.

export interface StageDTO {
  id: string;
  name: string;
  slug: string;
  order: number;
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
}

export interface ScheduleResponse {
  updatedAt: string;
  stages: StageDTO[];
  performances: PerformanceDTO[];
}

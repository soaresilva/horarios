import type {
  ArtistDTO,
  PerformanceDTO,
  ScheduleResponse,
  StageDTO,
  ZoneDTO,
  ZoneWalkDTO,
} from "@/types/schedule";

export type Stage = StageDTO;
export type Zone = ZoneDTO;
export type ZoneWalk = ZoneWalkDTO;
export type Artist = ArtistDTO;

export interface Performance extends Omit<PerformanceDTO, "startTime" | "endTime"> {
  startTime: Date;
  endTime: Date;
}

export interface Schedule {
  updatedAt: Date;
  zones: Zone[];
  zoneWalks: ZoneWalk[];
  stages: Stage[];
  artists: Artist[];
  performances: Performance[];
  /** Artists keyed by id, so a block can resolve its links without scanning. */
  artistsById: Map<string, Artist>;
}

export function parseSchedule(dto: ScheduleResponse): Schedule {
  // The `?? []` fallbacks are a one-release shim, not defensive habit: a
  // visitor who went offline holding a cached response in the previous shape
  // gets it served back by the service worker's NetworkFirst rule, and
  // reading `.map` off an absent array would white-screen the page. The
  // cache version bump evicts those, so these can go after a release.
  const artists = dto.artists ?? [];
  return {
    updatedAt: new Date(dto.updatedAt),
    zones: dto.zones ?? [],
    zoneWalks: dto.zoneWalks ?? [],
    stages: dto.stages,
    artists,
    artistsById: new Map(artists.map((a) => [a.id, a])),
    performances: dto.performances.map((p) => ({
      ...p,
      startTime: new Date(p.startTime),
      endTime: new Date(p.endTime),
    })),
  };
}

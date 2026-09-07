import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  ArtistDTO,
  PerformanceDTO,
  ScheduleResponse,
  StageDTO,
  ZoneDTO,
  ZoneWalkDTO,
} from "@/types/schedule";

interface Params {
  params: Promise<{ slug: string }>;
}

// Dynamic by default (no `dynamic` export, no `use cache`): every request
// re-queries Postgres directly. The dataset is tiny and edits from /admin
// must be visible immediately, so there's no server-side cache layer to
// invalidate. Offline access is handled client-side by the service worker's
// NetworkFirst cache for this route, not by HTTP caching here.
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  const festival = await prisma.festival.findUnique({ where: { slug } });
  if (!festival) {
    return NextResponse.json({ error: "Festival not found" }, { status: 404 });
  }

  const [stages, performances, zones, artists] = await Promise.all([
    prisma.stage.findMany({ where: { festivalId: festival.id }, orderBy: { order: "asc" } }),
    prisma.performance.findMany({
      where: { stage: { festivalId: festival.id } },
      orderBy: { startTime: "asc" },
    }),
    prisma.zone.findMany({ where: { festivalId: festival.id }, orderBy: { order: "asc" } }),
    prisma.artist.findMany({ where: { festivalId: festival.id } }),
  ]);

  // Walks are fetched by zone rather than globally so one festival's
  // distances can never leak into another's.
  const zoneIds = zones.map((z) => z.id);
  const zoneWalks = zoneIds.length
    ? await prisma.zoneWalk.findMany({ where: { fromZoneId: { in: zoneIds } } })
    : [];

  const stageDTOs: StageDTO[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    order: s.order,
    zoneId: s.zoneId,
    address: s.address,
  }));

  const zoneDTOs: ZoneDTO[] = zones.map((z) => ({
    id: z.id,
    name: z.name,
    order: z.order,
    walkMinutesFromHub: z.walkMinutesFromHub,
  }));

  const zoneWalkDTOs: ZoneWalkDTO[] = zoneWalks.map((w) => ({
    fromZoneId: w.fromZoneId,
    toZoneId: w.toZoneId,
    minutes: w.minutes,
  }));

  const artistDTOs: ArtistDTO[] = artists.map((a) => ({
    id: a.id,
    name: a.name,
    country: a.country,
    genres: a.genres,
    spotifyUrl: a.spotifyUrl,
    instagramUrl: a.instagramUrl,
    sourceUrl: a.sourceUrl,
  }));

  const performanceDTOs: PerformanceDTO[] = performances.map((p) => ({
    id: p.id,
    artistName: p.artistName,
    date: p.date.toISOString().slice(0, 10),
    startTime: p.startTime.toISOString(),
    endTime: p.endTime.toISOString(),
    notes: p.notes,
    recommended: p.recommended,
    stageId: p.stageId,
    artistId: p.artistId,
  }));

  const body: ScheduleResponse = {
    updatedAt: new Date().toISOString(),
    zones: zoneDTOs,
    zoneWalks: zoneWalkDTOs,
    stages: stageDTOs,
    artists: artistDTOs,
    performances: performanceDTOs,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

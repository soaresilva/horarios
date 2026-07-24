import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PerformanceDTO, ScheduleResponse, StageDTO } from "@/types/schedule";

// Dynamic by default (no `dynamic` export, no `use cache`): every request
// re-queries Postgres directly. The dataset is tiny and edits from /admin
// must be visible immediately, so there's no server-side cache layer to
// invalidate. Offline access is handled client-side by the service worker's
// NetworkFirst cache for this route, not by HTTP caching here.
export async function GET() {
  const [stages, performances] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: "asc" } }),
    prisma.performance.findMany({ orderBy: { startTime: "asc" } }),
  ]);

  const stageDTOs: StageDTO[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    order: s.order,
  }));

  const performanceDTOs: PerformanceDTO[] = performances.map((p) => ({
    id: p.id,
    artistName: p.artistName,
    date: p.date.toISOString().slice(0, 10),
    startTime: p.startTime.toISOString(),
    endTime: p.endTime.toISOString(),
    notes: p.notes,
    stageId: p.stageId,
  }));

  const body: ScheduleResponse = {
    updatedAt: new Date().toISOString(),
    stages: stageDTOs,
    performances: performanceDTOs,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

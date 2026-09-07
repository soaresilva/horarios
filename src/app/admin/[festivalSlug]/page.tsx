import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";
import { AdminScheduleShell } from "@/components/admin/AdminScheduleShell";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { Performance, Stage } from "@/lib/schedule-client";

interface Props {
  params: Promise<{ festivalSlug: string }>;
}

export default async function AdminFestivalPage({ params }: Props) {
  try {
    await requireSession();
  } catch {
    redirect("/admin/login");
  }

  const { festivalSlug } = await params;
  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug } });
  if (!festival) notFound();

  const [stageRows, performanceRows] = await Promise.all([
    prisma.stage.findMany({ where: { festivalId: festival.id }, orderBy: { order: "asc" } }),
    prisma.performance.findMany({
      where: { stage: { festivalId: festival.id } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const stages: (Stage & { updatedAt: Date })[] = stageRows.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    order: s.order,
    zoneId: s.zoneId,
    address: s.address,
    updatedAt: s.updatedAt,
  }));
  const performances: (Performance & { updatedAt: Date })[] = performanceRows.map((p) => ({
    id: p.id,
    artistName: p.artistName,
    date: p.date.toISOString().slice(0, 10),
    startTime: p.startTime,
    endTime: p.endTime,
    notes: p.notes,
    recommended: p.recommended,
    stageId: p.stageId,
    artistId: p.artistId,
    updatedAt: p.updatedAt,
  }));

  // The editor's inputs are uncontrolled (defaultValue), so a bump to any
  // row's updatedAt or a change in the row set must remount it to reflect the
  // saved DB state — otherwise add-row inputs keep stale text after a create
  // and a re-save would duplicate it. This signature changes on every save
  // (bulk update touches every row's @updatedAt), create, and delete.
  const editorKey = performanceRows.map((p) => `${p.id}:${p.updatedAt.getTime()}`).join("|");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 text-zinc-100">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <Link href="/admin" className="text-[10px] text-zinc-600 hover:text-zinc-400">
            ← All festivals
          </Link>
          <h1 className="text-lg font-semibold">{festival.name} admin</h1>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm">
            Log out
          </button>
        </form>
      </header>

      <AdminScheduleShell
        festivalSlug={festival.slug}
        ft={{ timezone: festival.timezone, locale: festival.locale }}
        editorKey={editorKey}
        stages={stages}
        performances={performances}
      />
    </div>
  );
}

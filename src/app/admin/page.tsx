import { redirect } from "next/navigation";
import { logoutAction } from "@/app/admin/actions";
import { PerformanceForm } from "@/components/admin/PerformanceForm";
import { StageEditorForm } from "@/components/admin/StageEditorForm";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { Performance, Stage } from "@/lib/schedule-client";
import { performancesForDate, uniqueSortedDates } from "@/lib/grouping";
import { formatDayTabLabel } from "@/lib/time";

export default async function AdminDashboardPage() {
  try {
    await requireSession();
  } catch {
    redirect("/admin/login");
  }

  const [stageRows, performanceRows] = await Promise.all([
    prisma.stage.findMany({ orderBy: { order: "asc" } }),
    prisma.performance.findMany({ orderBy: { startTime: "asc" } }),
  ]);

  const stages: Stage[] = stageRows.map((s) => ({ id: s.id, name: s.name, slug: s.slug, order: s.order }));
  const performances: Performance[] = performanceRows.map((p) => ({
    id: p.id,
    artistName: p.artistName,
    date: p.date.toISOString().slice(0, 10),
    startTime: p.startTime,
    endTime: p.endTime,
    notes: p.notes,
    recommended: p.recommended,
    stageId: p.stageId,
  }));

  const days = uniqueSortedDates(performances);
  const gridCols = "grid-cols-[1.3fr_110px_125px_150px_150px_1fr_44px_auto]";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-4 text-zinc-100">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">PdC 2026 admin</h1>
        <form action={logoutAction}>
          <button type="submit" className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm">
            Log out
          </button>
        </form>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-400">Stages</h2>
        <div className="flex flex-col gap-2">
          {stages.map((stage) => (
            <StageEditorForm key={stage.id} stage={stage} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6 overflow-x-auto">
        <h2 className="text-sm font-semibold text-zinc-400">Performances</h2>
        {days.map((day) => {
          const { weekday, day: dayNum } = formatDayTabLabel(new Date(`${day}T12:00:00Z`));
          const dayPerformances = performancesForDate(performances, day)
            .slice()
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

          return (
            <div key={day} className="min-w-[950px]">
              <h3 className="mb-1 text-sm font-medium text-zinc-300">
                {weekday} {dayNum} <span className="text-zinc-600">({day})</span>
              </h3>
              <div className={`grid ${gridCols} items-center gap-x-2 gap-y-1`}>
                <div className="grid grid-cols-subgrid col-span-8 pb-1 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                  <span>Artist</span>
                  <span>Stage</span>
                  <span>Day</span>
                  <span>Start</span>
                  <span>End</span>
                  <span>Notes</span>
                  <span>Rec</span>
                  <span></span>
                </div>
                {dayPerformances.map((performance) => (
                  <PerformanceForm key={performance.id} stages={stages} performance={performance} />
                ))}
                <PerformanceForm stages={stages} defaultDate={day} />
              </div>
            </div>
          );
        })}

        <div className="min-w-[950px]">
          <h3 className="mb-1 text-sm font-medium text-zinc-300">Add a new day</h3>
          <div className={`grid ${gridCols} items-center gap-x-2 gap-y-1`}>
            <PerformanceForm stages={stages} />
          </div>
        </div>
      </section>
    </div>
  );
}

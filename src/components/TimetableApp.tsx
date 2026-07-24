"use client";

import { useMemo, useState } from "react";
import { DayTabs } from "@/components/DayTabs";
import { OtherStagesList } from "@/components/OtherStagesList";
import { StageGrid } from "@/components/StageGrid";
import { useSchedule } from "@/hooks/useSchedule";
import { useStarred } from "@/hooks/useStarred";
import { mainStages, otherStages, performancesForDate, uniqueSortedDates } from "@/lib/grouping";
import { formatClock, todayInFestivalTimezone } from "@/lib/time";

export function TimetableApp() {
  const { schedule, loading, error, reload } = useSchedule();
  const { isStarred, toggle } = useStarred();
  // Holds only the user's explicit tab choice; the default (today, falling
  // back to the first festival day) is derived below rather than pushed
  // into state via an effect, since `days` isn't known until the schedule
  // has loaded.
  const [dayOverride, setDayOverride] = useState<string | null>(null);
  const [view, setView] = useState<"main" | "other">("main");

  const days = useMemo(() => (schedule ? uniqueSortedDates(schedule.performances) : []), [schedule]);
  const today = useMemo(() => todayInFestivalTimezone(), []);
  const selectedDay = dayOverride && days.includes(dayOverride) ? dayOverride : (days.includes(today) ? today : (days[0] ?? null));

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">Loading timetable…</p>;
  }

  if (error || !schedule) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-zinc-400">{error ?? "No schedule available."}</p>
        <button
          type="button"
          onClick={reload}
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!selectedDay) {
    return <p className="p-4 text-sm text-zinc-500">No performances have been scheduled yet.</p>;
  }

  const dayPerformances = performancesForDate(schedule.performances, selectedDay);
  const main = mainStages(schedule.stages, dayPerformances);
  const other = otherStages(schedule.stages, dayPerformances);
  const mainPerformances = dayPerformances.filter((p) => main.some((s) => s.id === p.stageId));
  const otherPerformances = dayPerformances.filter((p) => other.some((s) => s.id === p.stageId));

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-3 pt-3">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-300">Paredes de Coura 2026</h1>
        <span className="text-[10px] text-zinc-600">Updated {formatClock(schedule.updatedAt)}</span>
      </header>

      <DayTabs
        days={days}
        selected={selectedDay}
        today={today}
        onSelect={(day) => {
          setDayOverride(day);
          setView("main");
        }}
      />

      {other.length > 0 && (
        <div className="flex gap-1.5 px-3 pb-1" role="tablist" aria-label="Stage group">
          <button
            type="button"
            role="tab"
            aria-selected={view === "main"}
            onClick={() => setView("main")}
            className={`rounded-full px-3 py-1 text-xs ${
              view === "main" ? "bg-zinc-100 text-zinc-950" : "bg-zinc-800/60 text-zinc-400"
            }`}
          >
            Main stages
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "other"}
            onClick={() => setView("other")}
            className={`rounded-full px-3 py-1 text-xs ${
              view === "other" ? "bg-zinc-100 text-zinc-950" : "bg-zinc-800/60 text-zinc-400"
            }`}
          >
            Other stages
          </button>
        </div>
      )}

      {view === "main" ? (
        <>
          <div className="flex px-3 text-xs font-medium text-zinc-400">
            <div className="w-11 shrink-0" />
            <div className="flex flex-1">
              {main.map((stage, i) => (
                <div key={stage.id} className={`flex-1 pb-1 ${i === 0 ? "pr-2" : "pl-2"}`}>
                  {stage.name}
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-6">
            <StageGrid stages={main} performances={mainPerformances} isStarred={isStarred} onToggleStar={toggle} />
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto pb-6">
          <OtherStagesList
            stages={other}
            performances={otherPerformances}
            isStarred={isStarred}
            onToggleStar={toggle}
          />
        </div>
      )}
    </div>
  );
}

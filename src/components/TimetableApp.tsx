"use client";

import { useMemo, useState } from "react";
import { DayTabs } from "@/components/DayTabs";
import { InstallBanner } from "@/components/InstallBanner";
import { RecommendationsToggle } from "@/components/RecommendationsToggle";
import { SideStageSection } from "@/components/SideStageSection";
import { SocialLinks } from "@/components/SocialLinks";
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

  const days = useMemo(() => (schedule ? uniqueSortedDates(schedule.performances) : []), [schedule]);
  const today = useMemo(() => todayInFestivalTimezone(), []);
  const selectedDay = dayOverride && days.includes(dayOverride) ? dayOverride : (days.includes(today) ? today : (days[0] ?? null));

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">Loading timetable…</p>;
  }

  // Only replace the whole app with an error screen when there's nothing to
  // show yet (the very first load failed). Once a schedule has loaded
  // successfully once, keep showing it — a later background refetch (the
  // 60s poll, or a focus/visibility refetch) failing, e.g. from a patchy
  // festival-grounds signal, must not blank out an already-working page the
  // visitor is mid-way through reading. That failure is instead surfaced as
  // a small inline notice below, next to the existing "Updated HH:MM"
  // timestamp, alongside the last successfully loaded data.
  if (!schedule) {
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

  return (
    <div className="flex h-dvh flex-col bg-background text-zinc-100">
      <header className="flex items-start justify-between px-3 pt-3">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-300">
          <a href="https://bolachas.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400">
            Horários Bolachas
          </a>
        </h1>
        <div className="flex flex-col items-end gap-1">
          <SocialLinks />
          <span className="text-[10px] text-zinc-600">Updated {formatClock(schedule.updatedAt)}</span>
          {error && (
            <button
              type="button"
              onClick={reload}
              className="text-[10px] text-amber-500 underline decoration-dotted"
              title={error}
            >
              Refresh failed, tap to retry
            </button>
          )}
        </div>
      </header>

      <InstallBanner />

      <p className="px-3 pb-1 pt-1 text-[10px] leading-snug text-zinc-600">
        End times are estimated since they are not officially revealed.
        <br />
        <a
          href="https://open.spotify.com/playlist/2zBxbOfM0JV1TzJvvhkYBs"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-400"
        >
          Playlist
        </a>
        . Download printable timetables:{" "}
        <a
          href="/files/pdc26.xlsx"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-400"
        >
          xls
        </a>
        /
        <a
          href="/files/pdc26.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-zinc-400"
        >
          pdf
        </a>
      </p>

      <div className="flex items-center gap-4 px-3 pb-1 text-[10px] text-zinc-500">
        <RecommendationsToggle />
        <span className="flex items-center gap-1">
          <span aria-hidden className="text-accent">★</span>
          your favorites
        </span>
      </div>

      <DayTabs days={days} selected={selectedDay} today={today} onSelect={setDayOverride} />

      <div className="flex-1 overflow-y-auto pb-6">
        {other.map((stage) => (
          <SideStageSection
            key={stage.id}
            stage={stage}
            performances={dayPerformances.filter((p) => p.stageId === stage.id)}
            isStarred={isStarred}
            onToggleStar={toggle}
          />
        ))}

        <div>
          {/* Sticky, same as each side stage's header above: whichever
              section is actually in view keeps its label pinned to the top
              as you scroll, main stages included.

              Deliberately opaque (`bg-background`) with no `backdrop-blur`.
              A backdrop-filter on a sticky element inside a scroll
              container makes Safari recompute a blurred backdrop every
              scroll frame, which is what made scrolling stutter on iOS,
              and it also left this header's text unpainted on first
              render (present in the DOM with correct computed style, just
              never composited) until a later relayout forced it. Since
              the background was already 95% opaque, the blur was doing
              almost nothing visually — dropping it costs nothing and
              removes both failure modes.

              Keyed by the paired stage ids so a day whose pairing differs
              remounts this subtree wholesale rather than having React
              append one new label into the existing header. */}
          <div
            key={main.map((s) => s.id).join(",")}
            className="sticky top-0 z-20 flex bg-background px-3 pt-2 text-xs font-medium text-zinc-400"
          >
            <div className="w-11 shrink-0" />
            <div className="flex flex-1">
              {main.map((stage, i) => (
                <div key={stage.id} className={`flex-1 pb-1 ${i === 0 ? "pr-2" : "pl-2"}`}>
                  {stage.name}
                </div>
              ))}
            </div>
          </div>
          <div className="px-3">
            <StageGrid stages={main} performances={mainPerformances} isStarred={isStarred} onToggleStar={toggle} />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { SearchField, SearchResults } from "@/components/ArtistSearch";
import { CrewButton } from "@/components/CrewButton";
import { DayTabs } from "@/components/DayTabs";
import { FavoritesListView } from "@/components/FavoritesListView";
import { HelpToggle } from "@/components/HelpToggle";
import { InstallBanner } from "@/components/InstallBanner";
import { MarkSheet } from "@/components/MarkSheet";
import { MarksHint } from "@/components/MarksHint";
import { NotesToggle } from "@/components/NotesToggle";
import { RecommendationsToggle } from "@/components/RecommendationsToggle";
import { HiddenToggle, NonConcertsToggle, SideProgrammeToggle } from "@/components/SideProgrammeToggle";
import { SideStageSection } from "@/components/SideStageSection";
import { SocialLinks } from "@/components/SocialLinks";
import { StageGrid } from "@/components/StageGrid";
import { SyncFavoritesButton } from "@/components/SyncFavoritesButton";
import { TransposedGrid } from "@/components/TransposedGrid";
import { ViewToggle, type TimetableView } from "@/components/ViewToggle";
import { useCrew } from "@/hooks/useCrew";
import { useFavoritesSync } from "@/hooks/useFavoritesSync";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";
import { useMarksHintDismissed } from "@/hooks/useMarksHintDismissed";
import { useSchedule } from "@/hooks/useSchedule";
import { useShowHelp } from "@/hooks/useShowHelp";
import { useShowNotes } from "@/hooks/useShowNotes";
import { useShowCrewSets, useShowHidden, useShowNonConcerts, useShowSideProgramme } from "@/hooks/useShowSideProgramme";
import { crewsEnabled, festivalCopy, programmeCopy } from "@/lib/festival-copy";
import { actKeysById, countHiddenActs, idsOfAct, isGridVisible } from "@/lib/hidden";
import { contextLine } from "@/lib/programme";
import { mainStages, otherStages, performancesForDate, uniqueSortedDates } from "@/lib/grouping";
import { searchPerformances } from "@/lib/search";
import { otherShowsOf, showOrdinals } from "@/lib/shows";
import { formatClock, todayInFestivalTimezone, type FestivalTime } from "@/lib/time";

export type TimetableLayoutName = "VERTICAL" | "TRANSPOSED";

interface TimetableAppProps {
  festivalSlug: string;
  // Comes from the Festival row via the server component, not the DTO: it
  // never changes for an edition, so there's nothing to refetch, and having
  // it on the first render avoids formatting a single clock in the wrong zone
  // or flashing the wrong layout.
  ft: FestivalTime;
  layout: TimetableLayoutName;
}

export function TimetableApp({ festivalSlug, ft, layout }: TimetableAppProps) {
  const { schedule, loading, error, reload } = useSchedule(festivalSlug);
  const {
    tierOf,
    noteOf,
    cycle,
    setTier,
    setNote,
    hiddenActs,
    isActHidden,
    hideAct,
    unhideAct,
    synced,
    generateCode,
    redeemCode,
  } = useFavoritesSync(festivalSlug);
  const { show: showHidden, toggle: toggleShowHidden } = useShowHidden(festivalSlug);
  const hint = useMarksHintDismissed(festivalSlug);
  const { show: showNotes, toggle: toggleShowNotes } = useShowNotes(festivalSlug);
  const { show: showHelp, toggle: toggleShowHelp } = useShowHelp();
  // Crews (friends' picks as tag bubbles) are switched on per festival in
  // festival-copy.ts. Off, useCrew stays inert and `friendsOf` is left
  // undefined, so every block renders exactly as it did before crews.
  const crewOn = crewsEnabled(festivalSlug);
  const crew = useCrew(festivalSlug, crewOn);
  const crewSets = useShowCrewSets(festivalSlug);
  const programme = programmeCopy(festivalSlug);
  const { show: showSideProgramme, toggle: toggleSideProgramme } = useShowSideProgramme(
    festivalSlug,
    programme.side.defaultShown,
  );
  const { show: showNonConcerts, toggle: toggleNonConcerts } = useShowNonConcerts(
    festivalSlug,
    programme.nonConcertsDefaultShown,
  );
  // Holds only the user's explicit tab choice; the default (today, falling
  // back to the first festival day) is derived below rather than pushed
  // into state via an effect, since `days` isn't known until the schedule
  // has loaded.
  const [dayOverride, setDayOverride] = useState<string | null>(null);
  // Which set walking distances are measured from, in the transposed layout.
  // Tapping the same block again clears it.
  const [originId, setOriginId] = useState<string | null>(null);
  // The set MarkSheet is currently open for, or null when it's closed. Next
  // to originId for the same reason: both are "which set is the UI
  // currently focused on" state, just for two different surfaces.
  const [sheetPerformanceId, setSheetPerformanceId] = useState<string | null>(null);
  const dismissHint = hint.dismiss;

  // Hiding is per act (actKeyOf in src/lib/shows.ts), but every surface
  // below asks per set, so the set → act lookup is built once per schedule.
  const actKeyById = useMemo(() => actKeysById(schedule?.performances ?? []), [schedule]);
  const actHidden = useCallback(
    (id: string) => {
      const key = actKeyById.get(id);
      return key !== undefined && isActHidden(key);
    },
    [actKeyById, isActHidden],
  );
  const hiddenCount = useMemo(() => countHiddenActs(hiddenActs, actKeyById), [hiddenActs, actKeyById]);
  // Unhiding the last act also turns "show hidden" back off. Left on, the
  // next hide would only dim the act instead of taking it off the grid.
  const unhide = useCallback(
    (actKey: string) => {
      unhideAct(actKey);
      if (showHidden && hiddenCount === 1) toggleShowHidden();
    },
    [unhideAct, showHidden, hiddenCount, toggleShowHidden],
  );
  // Marking a set of a hidden act brings the act back: you've just said you
  // want to see it. Only reachable while "show hidden" is on (or from a
  // pairing merge), since a hidden act's sets aren't on the grid otherwise.
  const unhideIfMarked = useCallback(
    (id: string, nextTier: MarkTier | null) => {
      const key = actKeyById.get(id);
      if (nextTier !== null && key !== undefined && isActHidden(key)) unhide(key);
    },
    [actKeyById, isActHidden, unhide],
  );

  // Single object threaded down instead of the old isStarred/onToggleStar
  // pair, replacing four props (tier read, note read, cycle, open-sheet)
  // with one across every block/grid component. Wraps the raw mark
  // mutators so the "tap a set / hold a set" hint auto-dismisses the first
  // time a visitor actually uses either gesture, on top of the explicit
  // dismiss button on MarksHint itself.
  const marks: MarkControls = useMemo<MarkControls>(
    () => ({
      tierOf,
      noteOf,
      cycle: (id: string) => {
        // cycle goes null → must → interested → null, so it lands on a tier
        // from anything but "interested".
        unhideIfMarked(id, tierOf(id) === "interested" ? null : "must");
        cycle(id);
        dismissHint();
      },
      setTier: (id: string, tier) => {
        unhideIfMarked(id, tier);
        setTier(id, tier);
        dismissHint();
      },
      setNote,
      openSheet: (id: string) => {
        setSheetPerformanceId(id);
        dismissHint();
      },
      showNotes,
      friendsOf: crewOn ? crew.friendsOf : undefined,
      actHidden,
    }),
    [tierOf, noteOf, cycle, setTier, setNote, dismissHint, showNotes, crewOn, crew.friendsOf, actHidden, unhideIfMarked],
  );
  // Grid (either layout) vs. the favorites-only list. Orthogonal to
  // `layout`, so it isn't reset when the day changes — a visitor who
  // switched into their favorites list for one day almost certainly wants
  // it for the next one too.
  const [view, setView] = useState<TimetableView>("grid");
  // Artist search. While non-empty its results replace the grid or list,
  // festival-wide; clearing it puts back whatever was there.
  const [query, setQuery] = useState("");
  const searchResults = useMemo(() => searchPerformances(schedule?.performances ?? [], query), [schedule, query]);

  const days = useMemo(() => (schedule ? uniqueSortedDates(schedule.performances) : []), [schedule]);
  // Across the whole festival, not the selected day: the point of "#2/3" is
  // that the other shows are on other days.
  const ordinals = useMemo(
    () => showOrdinals(schedule?.performances ?? []),
    [schedule],
  );
  const today = useMemo(() => todayInFestivalTimezone(ft), [ft]);
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
  // The side-programme and non-concerts switches only thin the grids. The
  // favourites list keeps every marked set whatever they say (a set you
  // marked shouldn't silently vanish), and ordinals / "Also plays" stay
  // festival-wide so "#2/3" means the same thing either way. Rooms and the
  // day's time window are derived from gridPerformances, so a room with
  // nothing left drops out and a 10:00 talk stops stretching the axis.
  const hasSideProgramme = schedule.performances.some((p) => p.series !== null);
  const hasNonConcerts = schedule.performances.some((p) => p.kind !== "CONCERT");
  // Hidden acts go the same way, before the room/stage split, so a room
  // left with nothing but hidden acts drops out too (isGridVisible keeps a
  // marked set whatever).
  const gridPerformances = dayPerformances.filter(
    (p) =>
      (showSideProgramme || p.series === null) &&
      (showNonConcerts || p.kind === "CONCERT") &&
      isGridVisible({ actHidden: actHidden(p.id), tier: tierOf(p.id), showHidden }),
  );
  const copy = festivalCopy(festivalSlug);
  const notes = [copy?.disclaimer, copy?.help].filter(Boolean).join(" ");
  const gridColumns = copy?.gridColumns ?? 2;
  const main = mainStages(schedule.stages, gridPerformances, gridColumns);
  const other = otherStages(schedule.stages, gridPerformances, gridColumns);
  const mainPerformances = gridPerformances.filter((p) => main.some((s) => s.id === p.stageId));
  const isTransposed = layout === "TRANSPOSED";

  return (
    <div className="flex h-dvh flex-col bg-background text-zinc-100">
      <header className="flex items-start justify-between px-3 pt-3">
        <div className="flex flex-col gap-0.5">
          <Link href="/archive" className="text-[10px] text-zinc-600 hover:text-zinc-400">
            ← Horários archive
          </Link>
          <h1 className="text-sm font-semibold tracking-wide text-zinc-300">
            <a href="https://bolachas.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400">
              Horários Bolachas
            </a>
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <SocialLinks />
          <span className="text-[10px] text-zinc-600">Updated {formatClock(schedule.updatedAt, ft)}</span>
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
      {showHelp && <MarksHint dismissed={hint.dismissed} onDismiss={hint.dismiss} />}

      {/* The whole blurb (facts, how-to and links) goes with the help switch:
          the point of switching it off is to give the grid the screen. */}
      {copy && showHelp && (
        <p className="px-3 pt-1 pb-1 text-[10px] leading-snug text-zinc-600">
          {notes}
          {copy.links && copy.links.length > 0 && (
            <>
              {notes && " "}
              {copy.links.map((link, i) => (
                <span key={link.href}>
                  {i > 0 && " · "}
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-zinc-400"
                  >
                    {link.label}
                  </a>
                </span>
              ))}
            </>
          )}
        </p>
      )}

      {/* Sync is independent of `legend`: that flag only controls the
          recommends/favorites explainer row (redundant on some editions,
          see festival-copy.ts), but cross-device sync is useful on every
          festival regardless of whether this row shows. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-1 text-[10px] text-zinc-500">
        {(copy?.legend ?? true) && (
          <>
            <RecommendationsToggle />
            {showHelp && (
              <>
                <span className="flex items-center gap-1">
                  <span aria-hidden className="text-accent">★</span>
                  must-see
                  <span aria-hidden className="text-interested">☆</span>
                  maybe
                </span>
                <span className="text-zinc-600">tap to change</span>
              </>
            )}
          </>
        )}
        <SyncFavoritesButton synced={synced} generateCode={generateCode} redeemCode={redeemCode} />
        {crewOn && <CrewButton crew={crew} festivalSlug={festivalSlug} ft={ft} />}
        <NotesToggle show={showNotes} onToggle={toggleShowNotes} />
        {hasSideProgramme && (
          <SideProgrammeToggle show={showSideProgramme} onToggle={toggleSideProgramme} copy={programme.side} />
        )}
        {hasNonConcerts && <NonConcertsToggle show={showNonConcerts} onToggle={toggleNonConcerts} />}
        {/* Only once something is hidden. Also while the switch is still on
            with nothing left to show, so it can't get stuck on unseen and
            make the next hide look like it did nothing. */}
        {(hiddenCount > 0 || showHidden) && (
          <HiddenToggle show={showHidden} count={hiddenCount} onToggle={toggleShowHidden} />
        )}
        <HelpToggle show={showHelp} onToggle={toggleShowHelp} />
      </div>

      {/* Picking a day ends a search: the results ignore the day, so leaving
          them up would make the tap look like it did nothing. */}
      <DayTabs
        days={days}
        selected={selectedDay}
        today={today}
        ft={ft}
        onSelect={(day) => {
          setDayOverride(day);
          setQuery("");
        }}
      />

      <div className="flex items-center gap-2 px-3 pb-2">
        <SearchField query={query} onChange={setQuery} />
        <ViewToggle view={view} onChange={setView} />
      </div>

      {query.trim() ? (
        <SearchResults
          query={query}
          results={searchResults}
          stages={schedule.stages}
          marks={marks}
          sideTag={programme.side.otherShowTag}
          ft={ft}
          onSelect={(id) => {
            // Also moves the day tab, so clearing the search lands on the
            // grid for the day of the set just looked at.
            const performance = schedule.performances.find((p) => p.id === id);
            if (performance) setDayOverride(performance.date);
            marks.openSheet(id);
          }}
        />
      ) : view === "list" ? (
        <FavoritesListView
          performances={dayPerformances}
          stages={schedule.stages}
          zoneWalks={schedule.zoneWalks}
          artistsById={schedule.artistsById}
          ordinals={ordinals}
          marks={marks}
          ft={ft}
          crewSets={crew.crew && crew.crew.members.length > 0 ? crewSets : undefined}
          showHidden={showHidden}
        />
      ) : isTransposed ? (
        <TransposedGrid
          stages={schedule.stages}
          zones={schedule.zones}
          zoneWalks={schedule.zoneWalks}
          performances={gridPerformances}
          artistsById={schedule.artistsById}
          ordinals={ordinals}
          originPerformanceId={originId}
          marks={marks}
          programme={programme}
          scale={copy?.horizontalScale}
          ft={ft}
          onSelectOrigin={(id) => setOriginId((current) => (current === id ? null : id))}
        />
      ) : (
      <div className="flex-1 overflow-y-auto pb-6">
        {other.map((stage) => (
          <SideStageSection
            key={stage.id}
            stage={stage}
            performances={gridPerformances.filter((p) => p.stageId === stage.id)}
            marks={marks}
            ft={ft}
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
                <div
                  key={stage.id}
                  className={`min-w-0 flex-1 pb-1 ${i > 0 ? "pl-2" : ""} ${i < main.length - 1 ? "pr-2" : ""}`}
                >
                  {stage.name}
                </div>
              ))}
            </div>
          </div>
          <div className="px-3">
            <StageGrid
              stages={main}
              performances={mainPerformances}
              marks={marks}
              ft={ft}
              artistsById={schedule.artistsById}
            />
          </div>
        </div>
      </div>
      )}

      {sheetPerformanceId &&
        (() => {
          // Looked up fresh on every render rather than cached in state
          // alongside the id: the sheet must track the performance's own
          // stage/time if the schedule refetches while it's open, and a
          // stale id (set deleted server-side mid-session) just closes the
          // sheet instead of crashing. Festival-wide, not dayPerformances:
          // search opens it for sets on any day.
          const sheetPerformance = schedule.performances.find((p) => p.id === sheetPerformanceId);
          const sheetStage = sheetPerformance ? schedule.stages.find((s) => s.id === sheetPerformance.stageId) : null;
          if (!sheetPerformance || !sheetStage) return null;
          // Scanned over the whole festival, not dayPerformances: an act's
          // other sets are usually on other days, which is the entire reason
          // to show them. A stage that somehow has no row is dropped rather
          // than rendered as "at undefined".
          const actKey = actKeyById.get(sheetPerformance.id);
          const actIds = actKey === undefined ? [] : idsOfAct(schedule.performances, actKey);
          const otherShows = otherShowsOf(schedule.performances, sheetPerformance.id).flatMap((p) => {
            const stage = schedule.stages.find((s) => s.id === p.stageId);
            return stage
              ? [{ id: p.id, date: p.date, startTime: p.startTime, stageName: stage.name, series: p.series }]
              : [];
          });
          return (
            <MarkSheet
              artistName={sheetPerformance.artistName}
              startTime={sheetPerformance.startTime}
              endTime={sheetPerformance.endTime}
              stageName={sheetStage.name}
              context={contextLine(sheetPerformance, programme)}
              sideTag={programme.side.otherShowTag}
              tier={marks.tierOf(sheetPerformance.id)}
              note={marks.noteOf(sheetPerformance.id)}
              otherShows={otherShows}
              crew={marks.friendsOf?.(sheetPerformance.id)}
              ft={ft}
              onSetTier={(tier) => marks.setTier(sheetPerformance.id, tier)}
              onSetNote={(text) => marks.setNote(sheetPerformance.id, text)}
              onClose={() => setSheetPerformanceId(null)}
              hidden={actHidden(sheetPerformance.id)}
              actSetCount={actIds.length}
              onHide={
                actKey === undefined
                  ? undefined
                  : () => {
                      hideAct(actKey, actIds);
                      setSheetPerformanceId(null);
                    }
              }
              onUnhide={
                actKey === undefined
                  ? undefined
                  : () => unhide(actKey)
              }
            />
          );
        })()}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { ArtistLinksRail } from "@/components/ArtistLinksRail";
import { CrewBubbles } from "@/components/CrewBubbles";
import { EyeOff, ThumbsUp } from "@/components/icons";
import type { BooleanPref } from "@/hooks/slugBooleanPref";
import type { MarkControls } from "@/hooks/useMarks";
import { useShowRecommendations } from "@/hooks/useShowRecommendations";
import { artistLinksFor } from "@/lib/artist-links";
import { crewColor } from "@/lib/crew";
import type { Artist, Performance, Stage, ZoneWalk } from "@/lib/schedule-client";
import { parseCancellation, type ShowOrdinal } from "@/lib/shows";
import { formatClock, type FestivalTime } from "@/lib/time";
import { stageMapsUrls } from "@/lib/venues";
import { walkSegmentBetweenStages, type WalkSegment } from "@/lib/zones";

interface FavoritesListViewProps {
  /** The full day-scoped performance list, across every stage — filtered to marked ones here, same as StageGrid filters to its own stage internally. */
  performances: Performance[];
  stages: Stage[];
  zoneWalks: ZoneWalk[];
  artistsById: Map<string, Artist>;
  ordinals: Map<string, ShowOrdinal>;
  marks: MarkControls;
  ft: FestivalTime;
  /**
   * The "crew picks" switch: also list sets only crewmates marked. Passed
   * only when the festival has crews and this visitor is in one, so the
   * switch never shows for anyone it can't do anything for.
   */
  crewSets?: BooleanPref;
  /**
   * The "show hidden" switch. Your own marked sets list whatever it says (a
   * set you marked never silently vanishes); it only decides whether a
   * crewmate's pick of an act you hid shows up here.
   */
  showHidden?: boolean;
}

/** How a walk segment reads between two rows, or null when there's nothing honest to show. */
function walkLabel(segment: WalkSegment): string | null {
  if (segment.sameStage) return "same venue";
  if (segment.minutes === null) return null;
  if (segment.minutes === 0) return "same building";
  return `${segment.minutes} min walk`;
}

export function FavoritesListView({
  performances,
  stages,
  zoneWalks,
  artistsById,
  ordinals,
  marks,
  ft,
  crewSets,
  showHidden = false,
}: FavoritesListViewProps) {
  const { show: showRecommendations } = useShowRecommendations();
  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const mapsUrls = useMemo(() => stageMapsUrls(stages), [stages]);

  const friendsOf = (id: string) => marks.friendsOf?.(id) ?? [];
  const isMine = (p: Performance) => marks.tierOf(p.id) !== null;
  const isHidden = (p: Performance) => marks.actHidden?.(p.id) ?? false;
  const isCrewOnly = (p: Performance) =>
    !isMine(p) && friendsOf(p.id).length > 0 && (showHidden || !isHidden(p));
  const showCrew = crewSets?.show ?? false;
  const crewOnlyCount = performances.filter(isCrewOnly).length;

  // Both tiers, not just must-see — you plan a day around whatever you
  // actually intend to attend, must-see or interested alike. With the crew
  // switch on, sets only friends picked join in, dimmed, so the day shows
  // where everyone will be.
  const listed = performances
    .filter((p) => isMine(p) || (showCrew && isCrewOnly(p)))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const crewSwitch = crewSets && (
    <div className="flex justify-end pb-2">
      <CrewSetsToggle show={crewSets.show} onToggle={crewSets.toggle} />
    </div>
  );

  if (listed.length === 0) {
    return (
      <div>
        {crewSwitch && <div className="px-3">{crewSwitch}</div>}
        <p className="p-4 text-sm text-zinc-500">
          No marks yet for this day — tap a set to mark it must-see, tap again for interested.
          {crewSets && crewOnlyCount > 0 && ` Your crew picked ${crewOnlyCount} ${crewOnlyCount === 1 ? "set" : "sets"}: switch on crew picks to see them.`}
        </p>
      </div>
    );
  }

  // Walking times are about YOUR route, so they run from the previous set
  // you marked, skipping friends-only rows in between.
  const walkLabels = new Map<string, string | null>();
  let previousOwnStage: Stage | null = null;
  for (const performance of listed) {
    if (!isMine(performance)) continue;
    // Every stage here comes from a performance actually in `stages`, so
    // this is always found — trusting the foreign key rather than guarding
    // against a case the data can't produce.
    const stage = stagesById.get(performance.stageId)!;
    walkLabels.set(
      performance.id,
      previousOwnStage ? walkLabel(walkSegmentBetweenStages(zoneWalks, previousOwnStage, stage)) : null,
    );
    previousOwnStage = stage;
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-6">
      {crewSwitch}
      <div className="flex flex-col gap-2">
        {listed.map((performance) => {
          const stage = stagesById.get(performance.stageId)!;
          const mine = isMine(performance);
          const hidden = isHidden(performance);
          const label = walkLabels.get(performance.id) ?? null;

          const links = artistLinksFor(performance, artistsById);
          const artist = performance.artistId ? artistsById.get(performance.artistId) : undefined;
          const ordinal = ordinals.get(performance.id);
          const showOrdinal = ordinal && ordinal.total > 1;
          const tier = marks.tierOf(performance.id);
          const note = marks.noteOf(performance.id);
          const friends = friendsOf(performance.id);
          const friendNotes = friends.filter((f) => f.note);
          const { cancelled, displayName } = parseCancellation(performance.artistName);
          const nameNode = artist?.sourceUrl ? (
            <a
              href={artist.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-zinc-600 decoration-dotted underline-offset-2 hover:decoration-accent"
            >
              {displayName}
            </a>
          ) : (
            displayName
          );
          const tint = !mine
            ? "border border-dashed border-zinc-600 bg-zinc-900/60"
            : tier === "must"
              ? "bg-accent/20 ring-1 ring-accent"
              : "bg-interested/15 ring-1 ring-interested/70";

          return (
            <div
              key={performance.id}
              data-performance-id={performance.id}
              data-crew-only={mine ? undefined : "true"}
              data-hidden={hidden ? "true" : undefined}
              className={`flex flex-col ${hidden ? "opacity-40" : ""}`}
            >
              {label && (
                <div className="flex items-center gap-2 py-1 pl-4 text-[10px] text-zinc-600">
                  <span aria-hidden className="h-3 w-px bg-zinc-700" />
                  {label}
                </div>
              )}
              <div className={`relative rounded-md py-2 pr-9 pl-3 ${tint}`}>
                <span
                  className={`block text-sm leading-tight font-medium sm:text-base ${mine ? "text-zinc-100" : "text-zinc-400"}`}
                >
                  {hidden && <EyeOff className="mr-1 inline-block h-3 w-3 align-[-0.125em] text-zinc-400" />}
                  {cancelled && <span className="text-zinc-500">[cancelled] </span>}
                  {cancelled ? <span className="text-zinc-500 line-through">{nameNode}</span> : nameNode}
                  {performance.recommended && showRecommendations && (
                    <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
                  )}
                </span>
                <span className="block text-[10px] leading-tight text-zinc-400 sm:text-xs">
                  {formatClock(performance.startTime, ft)}–{formatClock(performance.endTime, ft)}
                  {showOrdinal && (
                    <span className="text-zinc-500">
                      {" "}
                      · #{ordinal.index}/{ordinal.total}
                    </span>
                  )}
                  {" · "}
                  <a href={mapsUrls.get(stage.id)} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                    {stage.name}
                  </a>
                  <CrewBubbles friends={friends} className="ml-1.5" />
                </span>
                {/* Full text, not just a ✎ glyph — this is the one place in
                    the app with room to show a note in full rather than
                    behind a hover tooltip. Friends' notes follow yours. */}
                {note && <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500 italic">{note}</span>}
                {friendNotes.map((friend) => (
                  <span key={friend.tag} className="mt-0.5 block text-[10px] leading-snug text-zinc-500 italic">
                    <span className="font-semibold not-italic" style={{ color: crewColor(friend.colorIndex) }}>
                      {friend.tag}:
                    </span>{" "}
                    {friend.note}
                  </span>
                ))}

                <ArtistLinksRail
                  artistName={performance.artistName}
                  links={links}
                  tier={tier}
                  orientation="horizontal"
                  onCycle={() => marks.cycle(performance.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Same track/knob role="switch" shape as NotesToggle and SideProgrammeToggle.
function CrewSetsToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      title={show ? "Hide sets only your crew picked" : "Also list sets only your crew picked"}
      className="flex items-center gap-1.5 py-1.5 text-[10px]"
    >
      <span
        aria-hidden
        className={`relative block h-3.5 w-6 shrink-0 rounded-full transition-colors ${show ? "bg-accent" : "bg-zinc-700"}`}
      >
        <span
          className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white transition-all ${show ? "left-3" : "left-0.5"}`}
        />
      </span>
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>crew picks</span>
    </button>
  );
}

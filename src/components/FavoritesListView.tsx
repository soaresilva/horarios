"use client";

import { useMemo } from "react";
import { ArtistLinksRail } from "@/components/ArtistLinksRail";
import { ThumbsUp } from "@/components/icons";
import type { MarkControls } from "@/hooks/useMarks";
import { useShowRecommendations } from "@/hooks/useShowRecommendations";
import { artistLinksFor } from "@/lib/artist-links";
import type { Artist, Performance, Stage, ZoneWalk } from "@/lib/schedule-client";
import type { ShowOrdinal } from "@/lib/shows";
import { formatClock, type FestivalTime } from "@/lib/time";
import { stageMapsUrl } from "@/lib/venues";
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
}

/** How a walk segment reads between two rows, or null when there's nothing honest to show. */
function walkLabel(segment: WalkSegment): string | null {
  if (segment.sameStage) return "same venue";
  if (segment.minutes === null) return null;
  if (segment.minutes === 0) return "same building";
  return `${segment.minutes} min walk`;
}

export function FavoritesListView({ performances, stages, zoneWalks, artistsById, ordinals, marks, ft }: FavoritesListViewProps) {
  const { show: showRecommendations } = useShowRecommendations();
  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  // Both tiers, not just must-see — you plan a day around whatever you
  // actually intend to attend, must-see or interested alike.
  const marked = performances
    .filter((p) => marks.tierOf(p.id) !== null)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  if (marked.length === 0) {
    return (
      <p className="p-4 text-sm text-zinc-500">
        No marks yet for this day — tap a set to mark it must-see, tap again for interested.
      </p>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-6">
      <div className="flex flex-col gap-2">
        {marked.map((performance, i) => {
          // Every stage here comes from a performance actually in `stages`,
          // so this is always found — trusting the foreign key rather than
          // guarding against a case the data can't produce.
          const stage = stagesById.get(performance.stageId)!;
          const previous = i > 0 ? marked[i - 1] : null;
          const previousStage = previous ? stagesById.get(previous.stageId)! : null;
          const label = previousStage ? walkLabel(walkSegmentBetweenStages(zoneWalks, previousStage, stage)) : null;

          const links = artistLinksFor(performance, artistsById);
          const artist = performance.artistId ? artistsById.get(performance.artistId) : undefined;
          const ordinal = ordinals.get(performance.id);
          const showOrdinal = ordinal && ordinal.total > 1;
          const tier = marks.tierOf(performance.id);
          const note = marks.noteOf(performance.id);
          const tint = tier === "must" ? "bg-accent/20 ring-1 ring-accent" : "bg-interested/15 ring-1 ring-interested/70";

          return (
            <div key={performance.id} className="flex flex-col">
              {label && (
                <div className="flex items-center gap-2 py-1 pl-4 text-[10px] text-zinc-600">
                  <span aria-hidden className="h-3 w-px bg-zinc-700" />
                  {label}
                </div>
              )}
              <div className={`relative rounded-md py-2 pr-9 pl-3 ${tint}`}>
                <span className="block text-sm leading-tight font-medium text-zinc-100 sm:text-base">
                  {artist?.sourceUrl ? (
                    <a
                      href={artist.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-zinc-600 decoration-dotted underline-offset-2 hover:decoration-accent"
                    >
                      {performance.artistName}
                    </a>
                  ) : (
                    performance.artistName
                  )}
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
                  <a href={stageMapsUrl(stage)} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                    {stage.name}
                  </a>
                </span>
                {/* Full text, not just a ✎ glyph — this is the one place in
                    the app with room to show a note in full rather than
                    behind a hover tooltip. */}
                {note && <span className="mt-0.5 block text-[10px] leading-snug text-zinc-500 italic">{note}</span>}

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

"use client";

import { ArtistLinksRail } from "@/components/ArtistLinksRail";
import { ThumbsUp } from "@/components/icons";
import type { ArtistLinks } from "@/lib/artist-links";
import type { Artist, Performance } from "@/lib/schedule-client";
import type { ShowOrdinal } from "@/lib/shows";
import { formatClock, type BlockLayout, type FestivalTime } from "@/lib/time";

interface TransposedPerformanceBlockProps {
  performance: Performance;
  artist: Artist | undefined;
  layout: BlockLayout;
  links: ArtistLinks;
  starred: boolean;
  showRecommendation: boolean;
  /** "#2/3" — only rendered when the act plays more than once. */
  ordinal: ShowOrdinal | undefined;
  /** True when this set is the chosen origin for walking distances. */
  isOrigin: boolean;
  ft: FestivalTime;
  onSelectOrigin: (id: string) => void;
  onToggleStar: (id: string) => void;
}

// One set in the transposed grid: positioned along the X axis, sized by
// duration. Three separate targets, all siblings so a tap lands on exactly
// one of them: the artist name opens the act's page on the festival site,
// the star in the rail stars it, and the rest of the block picks this set as
// the point walking distances are measured from.
export function TransposedPerformanceBlock({
  performance,
  artist,
  layout,
  links,
  starred,
  showRecommendation,
  ordinal,
  isOrigin,
  ft,
  onSelectOrigin,
  onToggleStar,
}: TransposedPerformanceBlockProps) {
  const showOrdinal = ordinal && ordinal.total > 1;

  return (
    <div
      data-performance-id={performance.id}
      style={{ left: layout.offset, width: layout.extent }}
      className={`absolute inset-y-1 overflow-hidden rounded-md transition-colors ${
        isOrigin
          ? "bg-zinc-700 ring-1 ring-zinc-400"
          : starred
            ? "bg-accent/20 ring-1 ring-accent"
            : "bg-zinc-800/70"
      }`}
    >
      {/* pr-14 clears the horizontal rail: star + two icons at p-1.5 with
          gap-1.5 comes to roughly 56px. */}
      <button
        type="button"
        onClick={() => onSelectOrigin(performance.id)}
        aria-pressed={isOrigin}
        aria-label={`Measure walking times from ${performance.artistName}`}
        className="absolute inset-0 flex h-full w-full flex-col justify-center rounded-md py-1 pl-2 pr-14 text-left"
      />

      <div className="pointer-events-none relative flex h-full flex-col justify-center py-1 pl-2 pr-14">
        <span className="truncate text-xs leading-tight font-semibold text-zinc-100">
          {artist?.sourceUrl ? (
            <a
              href={artist.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto underline decoration-zinc-600 decoration-dotted underline-offset-2 hover:decoration-accent"
            >
              {performance.artistName}
            </a>
          ) : (
            performance.artistName
          )}
          {performance.recommended && showRecommendation && (
            <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
          )}
        </span>
        <span className="truncate text-[10px] leading-tight text-zinc-400">
          {formatClock(performance.startTime, ft)}
          {artist?.country && <span className="text-zinc-500"> · {artist.country}</span>}
          {showOrdinal && (
            <span className="text-zinc-500">
              {" "}
              · #{ordinal.index}/{ordinal.total}
            </span>
          )}
        </span>
      </div>

      <ArtistLinksRail
        artistName={performance.artistName}
        links={links}
        starred={starred}
        orientation="horizontal"
        onToggleStar={() => onToggleStar(performance.id)}
      />
    </div>
  );
}

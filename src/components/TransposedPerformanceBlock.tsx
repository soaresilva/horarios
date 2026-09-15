"use client";

import { ArtistLinksRail } from "@/components/ArtistLinksRail";
import { Pencil, ThumbsUp } from "@/components/icons";
import { useLongPress } from "@/hooks/useLongPress";
import type { MarkControls } from "@/hooks/useMarks";
import type { ArtistLinks } from "@/lib/artist-links";
import type { Artist, Performance } from "@/lib/schedule-client";
import type { ShowOrdinal } from "@/lib/shows";
import { formatClock, type BlockLayout, type FestivalTime } from "@/lib/time";

interface TransposedPerformanceBlockProps {
  performance: Performance;
  artist: Artist | undefined;
  layout: BlockLayout;
  links: ArtistLinks;
  marks: MarkControls;
  showRecommendation: boolean;
  /** "#2/3" — only rendered when the act plays more than once. */
  ordinal: ShowOrdinal | undefined;
  /** True when this set is the chosen origin for walking distances. */
  isOrigin: boolean;
  ft: FestivalTime;
  onSelectOrigin: (id: string) => void;
}

// One set in the transposed grid: positioned along the X axis, sized by
// duration. Three separate targets, all siblings so a tap lands on exactly
// one of them: the artist name opens the act's page on the festival site,
// the star in the rail cycles the tier (a hold on it opens the note sheet),
// and the rest of the block picks this set as the point walking distances
// are measured from.
export function TransposedPerformanceBlock({
  performance,
  artist,
  layout,
  links,
  marks,
  showRecommendation,
  ordinal,
  isOrigin,
  ft,
  onSelectOrigin,
}: TransposedPerformanceBlockProps) {
  const showOrdinal = ordinal && ordinal.total > 1;
  const tier = marks.tierOf(performance.id);
  const note = marks.noteOf(performance.id);
  const longPress = useLongPress(() => marks.openSheet(performance.id));

  return (
    <div
      data-performance-id={performance.id}
      style={{ left: layout.offset, width: layout.extent }}
      className={`absolute inset-y-1 overflow-hidden rounded-md transition-colors ${
        isOrigin
          ? "bg-zinc-700 ring-1 ring-zinc-400"
          : tier === "must"
            ? "bg-accent/20 ring-1 ring-accent"
            : tier === "interested"
              ? "bg-interested/15 ring-1 ring-interested/70"
              : "bg-zinc-800/70"
      }`}
    >
      {/* Star-only rail, not the full Spotify/Instagram one PerformanceBlock
          uses: every block here caps at 40 minutes (200px at this scale), and
          a full 3-icon rail (~96px reserved, per the rail's own right-2 +
          p-1.5 + gap-1.5 geometry) would burn nearly half of even the widest
          block on icons that could barely be read anyway on a 26-room grid —
          which is exactly the crowding a first pass at this got complaints
          for. The rail sits right-2 from the edge and the star alone needs
          8 + 24 = 32px, hence pr-9. Spotify/Instagram are still one tap away
          via the artist's own festival page. That same tight budget is why
          the note indicator (✎, when a note exists) sits inline next to the
          clock below rather than in this rail — see the pr-9 width
          reasoning above, a fourth affordance here would break it. */}
      <button
        type="button"
        onClick={() => onSelectOrigin(performance.id)}
        aria-pressed={isOrigin}
        aria-label={`Measure walking times from ${performance.artistName}`}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onContextMenu={longPress.onContextMenu}
        className="absolute inset-0 flex h-full w-full select-none flex-col justify-center rounded-md py-1 pr-9 pl-2 text-left [-webkit-touch-callout:none]"
      />

      <div className="pointer-events-none relative flex h-full flex-col justify-center py-1 pr-9 pl-2">
        <span className="line-clamp-2 text-xs leading-tight font-semibold text-zinc-100">
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
          {showOrdinal && (
            <span className="text-zinc-500">
              {" "}
              · #{ordinal.index}/{ordinal.total}
            </span>
          )}
          {note && (
            <span title={note} className="pointer-events-auto ml-1 inline-block align-[-0.1em] text-zinc-400">
              <Pencil className="inline h-2.5 w-2.5" />
            </span>
          )}
        </span>
      </div>

      <ArtistLinksRail
        artistName={performance.artistName}
        links={links}
        tier={tier}
        orientation="horizontal"
        compact
        onCycle={() => {
          if (longPress.consumeSuppressedClick()) return;
          marks.cycle(performance.id);
        }}
      />
    </div>
  );
}

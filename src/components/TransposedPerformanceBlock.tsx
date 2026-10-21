"use client";

import { ArtistLinksRail } from "@/components/ArtistLinksRail";
import { CrewBubbles } from "@/components/CrewBubbles";
import { EyeOff, Pencil, ThumbsUp } from "@/components/icons";
import { InlineNote } from "@/components/InlineNote";
import { useLongPress } from "@/hooks/useLongPress";
import type { MarkControls } from "@/hooks/useMarks";
import type { ArtistLinks } from "@/lib/artist-links";
import type { ProgrammeCopy } from "@/lib/festival-copy";
import { contextLine, kindLabel } from "@/lib/programme";
import type { Artist, Performance } from "@/lib/schedule-client";
import { parseCancellation, type ShowOrdinal } from "@/lib/shows";
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
  /** The festival's side-programme chip and credit wording (src/lib/festival-copy.ts). */
  programme: ProgrammeCopy;
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
  programme,
  ft,
  onSelectOrigin,
}: TransposedPerformanceBlockProps) {
  const showOrdinal = ordinal && ordinal.total > 1;
  const tier = marks.tierOf(performance.id);
  const note = marks.noteOf(performance.id);
  const friends = marks.friendsOf?.(performance.id) ?? [];
  const showInlineNote = marks.showNotes && note !== "";
  const { cancelled, displayName } = parseCancellation(performance.artistName);
  // The act is hidden and only on screen because "show hidden" is on (or
  // the set is still marked): dimmed, with an eye-off before the name.
  const hidden = marks.actHidden?.(performance.id) ?? false;
  const longPress = useLongPress(() => marks.openSheet(performance.id));
  // Side-programme sets (TOUO, U?) share venue rows with the main
  // programme, so they're told apart by a dashed outline and the festival's
  // chip ("FREE", "U?") rather than by row. The tier ring still wins once a
  // set is marked: that's the state a visitor is scanning for.
  const isSide = performance.series !== null;
  // Films, talks, exhibitions and the rest carry a solid chip naming what
  // they are, so a six-hour exhibition block can't be read as a concert.
  const kind = kindLabel(performance.kind);
  const title = contextLine(performance, programme) ?? undefined;

  const nameNode = artist?.sourceUrl ? (
    <a
      href={artist.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto underline decoration-zinc-600 decoration-dotted underline-offset-2 hover:decoration-accent"
    >
      {displayName}
    </a>
  ) : (
    displayName
  );

  return (
    <div
      data-performance-id={performance.id}
      data-hidden={hidden ? "true" : undefined}
      style={{ left: layout.offset, width: layout.extent }}
      // overflow-clip, not overflow-hidden: `hidden` makes the block its own
      // scroll container, which would pin the sticky name below to the
      // block instead of to the grid's scroller.
      className={`absolute inset-y-1 overflow-clip rounded-md transition-colors ${
        isOrigin
          ? "bg-zinc-700 ring-1 ring-zinc-400"
          : tier === "must"
            ? "bg-accent/20 ring-1 ring-accent"
            : tier === "interested"
              ? "bg-interested/15 ring-1 ring-interested/70"
              : isSide
                ? "border border-dashed border-zinc-500 bg-zinc-900/80"
                : "bg-zinc-800/70"
      } ${hidden ? "opacity-40" : ""}`}
      title={title}
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

      {/* Sticky just right of the pinned venue column (w-28, 112px; see
          VENUE_COL in TransposedGrid.tsx), so a block that starts off-screen
          still says what it is: a six-hour exhibition scrolled to its
          middle would otherwise be an empty box. w-fit is what gives it
          room to slide; max-w-full keeps a short block's name wrapping
          exactly as before. */}
      <div className="pointer-events-none sticky left-28 flex h-full w-fit max-w-full flex-col justify-center py-1 pr-9 pl-2">
        <span className="line-clamp-2 text-xs leading-tight font-semibold text-zinc-100">
          {hidden && <EyeOff className="mr-1 inline-block h-3 w-3 align-[-0.125em] text-zinc-400" />}
          {cancelled && <span className="text-zinc-500">[cancelled] </span>}
          {cancelled ? <span className="text-zinc-500 line-through">{nameNode}</span> : nameNode}
          {performance.recommended && showRecommendation && (
            <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
          )}
        </span>
        <span className="truncate text-[10px] leading-tight text-zinc-400">
          {isSide && (
            <span className="mr-1 rounded-sm border border-dashed border-zinc-500 px-0.5 text-[8px] font-semibold text-zinc-300">
              {programme.side.chip}
            </span>
          )}
          {kind && (
            <span className="mr-1 rounded-sm bg-zinc-600 px-0.5 text-[8px] font-semibold text-zinc-100">{kind.chip}</span>
          )}
          {formatClock(performance.startTime, ft)}
          {showOrdinal && (
            <span className="text-zinc-500">
              {" "}
              · #{ordinal.index}/{ordinal.total}
            </span>
          )}
          {note && !showInlineNote && (
            <span title={note} className="pointer-events-auto ml-1 inline-block align-[-0.1em] text-zinc-400">
              <Pencil className="inline h-2.5 w-2.5" />
            </span>
          )}
          {/* Friends' picks, on the clock line for the same reason the ✎
              is: the rail has no room (see the pr-9 note above). Two
              bubbles then "+N", which a 40-minute block at 5px/min holds. */}
          <CrewBubbles friends={friends} max={2} onOpen={() => marks.openSheet(performance.id)} className="ml-1" />
        </span>
        {/* Third line, only present when the row grew to ROW_HEIGHT_WITH_NOTE
            (TransposedGrid.tsx) to hold it. pointer-events-auto because the
            content column above is pointer-events-none and the `title`
            tooltip needs to be hittable. */}
        {showInlineNote && <InlineNote note={note} lines={1} className="pointer-events-auto" />}
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

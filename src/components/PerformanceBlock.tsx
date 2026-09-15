"use client";

import type { Performance } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";
import type { BlockLayout, FestivalTime } from "@/lib/time";
import { Instagram, Pencil, Spotify, ThumbsUp } from "@/components/icons";
import { getArtistLinks } from "@/lib/artist-links";
import { useLongPress } from "@/hooks/useLongPress";
import type { MarkControls } from "@/hooks/useMarks";
import { markAriaLabel } from "@/lib/marks";

interface PerformanceBlockProps {
  performance: Performance;
  layout: BlockLayout;
  alternate: boolean;
  marks: MarkControls;
  showRecommendation: boolean;
  ft: FestivalTime;
}

export function PerformanceBlock({ performance, layout, alternate, marks, showRecommendation, ft }: PerformanceBlockProps) {
  const links = getArtistLinks(performance.artistName);
  const tier = marks.tierOf(performance.id);
  const note = marks.noteOf(performance.id);

  const longPress = useLongPress(() => marks.openSheet(performance.id));

  const tint =
    tier === "must"
      ? "bg-accent/20 ring-1 ring-accent"
      : tier === "interested"
        ? "bg-interested/15 ring-1 ring-interested/70"
        : alternate
          ? "bg-zinc-800/80"
          : "bg-zinc-800/40";

  // must-see keeps the original filled ★ in accent blue; interested is a
  // hollow ☆ in amber; unmarked is the original hollow ★ in dim zinc.
  const glyph = tier === "interested" ? "☆" : "★";
  const glyphColor = tier === "must" ? "text-accent" : tier === "interested" ? "text-interested" : "text-zinc-600";

  return (
    <div
      data-performance-id={performance.id}
      style={{ top: layout.offset, height: layout.extent }}
      className={`absolute left-1 right-1 rounded-md transition-colors ${tint}`}
    >
      {/* Fills the whole box: tap cycles the tier (unmarked → must-see →
          interested → unmarked), a 500ms hold opens the note sheet.
          select-none + touch-callout:none so iOS doesn't raise its
          text-selection callout mid-hold — the app already locks zoom
          (layout.tsx, maximumScale: 1), so there's no pinch interaction to
          protect here either. aria-label (not aria-pressed) describes the
          current state: a tri-state cycle isn't a toggle button. */}
      <button
        type="button"
        onClick={() => {
          if (longPress.consumeSuppressedClick()) return;
          marks.cycle(performance.id);
        }}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onContextMenu={longPress.onContextMenu}
        aria-label={markAriaLabel(performance.artistName, tier)}
        className="absolute inset-0 flex h-full w-full select-none flex-col justify-center rounded-md py-1 pl-2 pr-7 text-left [-webkit-touch-callout:none]"
      >
        <span className="text-sm leading-tight font-medium text-zinc-100 sm:text-base">
          {performance.artistName}
          {performance.recommended && showRecommendation && (
            <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
          )}
        </span>
        <span className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
          {formatClock(performance.startTime, ft)}–{formatClock(performance.endTime, ft)}
        </span>
      </button>

      {/* Icon rail, layered above the button so link taps hit the link, not
          the toggle. The rail is tall (top-1/bottom-1), so the note
          indicator fits right under the star — the transposed block's rail
          isn't tall enough for that, see TransposedPerformanceBlock.tsx. */}
      <div className="pointer-events-none absolute top-1 right-1 bottom-1 z-10 flex flex-col items-center gap-2.5">
        <span aria-hidden className={`text-xs leading-none ${glyphColor}`}>
          {glyph}
        </span>
        {note && (
          <span title={note} className="text-zinc-400">
            <Pencil className="h-3 w-3" />
          </span>
        )}
        {links.spotify && (
          <a
            href={links.spotify}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${performance.artistName} on Spotify`}
            className="pointer-events-auto p-1.5 text-zinc-500 transition-colors hover:text-accent"
          >
            <Spotify className="h-3.5 w-3.5" />
          </a>
        )}
        {links.instagram && (
          <a
            href={links.instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${performance.artistName} on Instagram`}
            className="pointer-events-auto p-1.5 text-zinc-500 transition-colors hover:text-accent"
          >
            <Instagram className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

"use client";

import type { Performance, Stage } from "@/lib/schedule-client";
import { formatClock, type FestivalTime } from "@/lib/time";
import { Instagram, Pencil, Spotify, ThumbsUp } from "@/components/icons";
import { InlineNote } from "@/components/InlineNote";
import { useLongPress } from "@/hooks/useLongPress";
import type { MarkControls } from "@/hooks/useMarks";
import { useShowRecommendations } from "@/hooks/useShowRecommendations";
import { getArtistLinks } from "@/lib/artist-links";
import { markAriaLabel } from "@/lib/marks";

interface SideStageSectionProps {
  stage: Stage;
  performances: Performance[];
  marks: MarkControls;
  ft: FestivalTime;
}

// One row: tap cycles the tier, a 500ms hold opens the note sheet, exactly
// like PerformanceBlock's full-bleed button.
function SideStageRow({ performance, marks, ft, showRecommendations }: { performance: Performance; marks: MarkControls; ft: FestivalTime; showRecommendations: boolean }) {
  const tier = marks.tierOf(performance.id);
  const note = marks.noteOf(performance.id);
  const links = getArtistLinks(performance.artistName);
  const longPress = useLongPress(() => marks.openSheet(performance.id));

  const tint =
    tier === "must"
      ? "bg-accent/20 ring-1 ring-accent"
      : tier === "interested"
        ? "bg-interested/15 ring-1 ring-interested/70"
        : "bg-zinc-800/60";
  const glyph = tier === "interested" ? "☆" : "★";
  const glyphColor = tier === "must" ? "text-accent" : tier === "interested" ? "text-interested" : "text-zinc-600";
  const showInlineNote = marks.showNotes && note !== "";

  return (
    <li data-performance-id={performance.id} className="relative">
      {/* Fills the row: tap cycles the tier, hold opens the note sheet.
          flex-col with a single full-width child (the name+time span below)
          lays out identically to a plain flex-row of the same two children,
          so with the toggle off this is byte-identical to before the note
          became a possible second row — see SideStageSection.test.tsx. */}
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
        className={`flex w-full select-none flex-col gap-0.5 rounded-md py-2 pl-3 pr-16 text-left [-webkit-touch-callout:none] ${tint}`}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-100">
            {performance.artistName}
            {performance.recommended && showRecommendations && (
              <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
            )}
          </span>
          <span className="text-xs text-zinc-400">
            {formatClock(performance.startTime, ft)}–{formatClock(performance.endTime, ft)}
          </span>
        </span>
        {showInlineNote && <InlineNote note={note} lines={2} />}
      </button>

      {/* Icon row, layered above the button so link taps hit the link, not the toggle. */}
      <div className="pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center gap-1.5">
        <span aria-hidden className={`text-xs leading-none ${glyphColor}`}>
          {glyph}
        </span>
        {note && !showInlineNote && (
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
            className="pointer-events-auto text-zinc-500 transition-colors hover:text-accent"
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
            className="pointer-events-auto text-zinc-500 transition-colors hover:text-accent"
          >
            <Instagram className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </li>
  );
}

// A free/side stage (Jazz na Relva, Xapas Lounge, ...), shown as its own
// section stacked above the main two-stage grid rather than tucked behind a
// separate tab. Its header is `sticky top-0`, same as the main stages'
// header below it — as you scroll past this section, the main stages'
// header naturally takes over the sticky slot, so whichever stage is
// actually on screen is always the one labeled at the top.
export function SideStageSection({ stage, performances, marks, ft }: SideStageSectionProps) {
  const { show: showRecommendations } = useShowRecommendations();
  const sorted = [...performances].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  if (sorted.length === 0) return null;

  return (
    <div className="mb-1">
      {/* Opaque, no backdrop-blur — see the matching comment on the
          main-grid sticky header in TimetableApp.tsx. */}
      <div className="sticky top-0 z-20 bg-background px-3 py-2">
        <span className="text-sm font-semibold text-zinc-200">{stage.name}</span>
      </div>
      <ul className="flex flex-col gap-1.5 px-3 pb-3">
        {sorted.map((performance) => (
          <SideStageRow key={performance.id} performance={performance} marks={marks} ft={ft} showRecommendations={showRecommendations} />
        ))}
      </ul>
    </div>
  );
}

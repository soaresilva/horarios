"use client";

import type { Artist, Performance } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";
import type { BlockLayout, FestivalTime } from "@/lib/time";
import { CrewBubbles } from "@/components/CrewBubbles";
import { EyeOff, Instagram, Pencil, Spotify, ThumbsUp } from "@/components/icons";
import { InlineNote } from "@/components/InlineNote";
import { getArtistLinks } from "@/lib/artist-links";
import { useLongPress } from "@/hooks/useLongPress";
import type { MarkControls } from "@/hooks/useMarks";
import { inlineNoteLines, markAriaLabel } from "@/lib/marks";
import { parseCancellation } from "@/lib/shows";

interface PerformanceBlockProps {
  performance: Performance;
  layout: BlockLayout;
  alternate: boolean;
  marks: MarkControls;
  showRecommendation: boolean;
  ft: FestivalTime;
  /**
   * Imported reference data (London Calling's artist pages). When present it
   * owns the links: the name opens the act's festival page and the rail
   * shows its Spotify/Instagram. Without one, the block falls back to the
   * hand-written PdC map in src/lib/artist-links.ts.
   */
  artist?: Artist;
  /**
   * Narrow column (three or more side by side, ~100px on a phone): 12px,
   * which fits London Calling's longest single words ("KatzPascale",
   * "Victoryland") beside the icon rail. Hyphenation/word-breaking is only a
   * last resort for anything longer; Chromium on macOS doesn't hyphenate,
   * so it can't be relied on. Off for PdC's two columns, unchanged.
   */
  compact?: boolean;
}

export function PerformanceBlock({ performance, layout, alternate, marks, showRecommendation, ft, artist, compact = false }: PerformanceBlockProps) {
  const links = artist
    ? { spotify: artist.spotifyUrl ?? undefined, instagram: artist.instagramUrl ?? undefined }
    : getArtistLinks(performance.artistName);
  const tier = marks.tierOf(performance.id);
  const note = marks.noteOf(performance.id);
  const friends = marks.friendsOf?.(performance.id) ?? [];
  const { cancelled, displayName } = parseCancellation(performance.artistName);
  // The act is hidden and only on screen because "show hidden" is on (or
  // the set is still marked): dimmed, with an eye-off before the name.
  const hidden = marks.actHidden?.(performance.id) ?? false;

  const longPress = useLongPress(() => marks.openSheet(performance.id));

  // Only when "display notes" is on AND the block is tall enough to hold at
  // least one line (inlineNoteLines(0) for a 40px/20-min block, say). Below
  // that the note stays behind the ✎ tooltip exactly as it does with the
  // toggle off.
  const noteLines = marks.showNotes ? inlineNoteLines(layout.extent) : 0;
  const showInlineNote = noteLines > 0 && note !== "";

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
      style={{ top: layout.offset, height: layout.extent }}
      className={`absolute left-1 right-1 rounded-md transition-colors ${showInlineNote ? "overflow-hidden" : ""} ${tint} ${hidden ? "opacity-40" : ""}`}
    >
      {/* Fills the whole box: tap cycles the tier (unmarked → must-see →
          interested → unmarked), a 500ms hold opens the note sheet.
          select-none + touch-callout:none so iOS doesn't raise its
          text-selection callout mid-hold — the app already locks zoom
          (layout.tsx, maximumScale: 1), so there's no pinch interaction to
          protect here either. aria-label (not aria-pressed) describes the
          current state: a tri-state cycle isn't a toggle button.

          The button is empty and the text sits in a pointer-events-none
          layer above it (same as TransposedPerformanceBlock), so the artist
          name can be a real link without nesting an <a> in a <button>:
          taps anywhere but the link fall through to the button. */}
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
        className="absolute inset-0 h-full w-full select-none rounded-md [-webkit-touch-callout:none]"
      />

      <div className="pointer-events-none relative flex h-full select-none flex-col justify-center py-1 pl-2 pr-7 text-left">
        <span
          className={`leading-tight font-medium text-zinc-100 sm:text-base ${
            compact ? "text-xs hyphens-auto break-words" : "text-sm"
          }`}
        >
          {hidden && <EyeOff className="mr-1 inline-block h-3 w-3 align-[-0.125em] text-zinc-400" />}
          {cancelled && <span className="text-zinc-500">[cancelled] </span>}
          {cancelled ? <span className="text-zinc-500 line-through">{nameNode}</span> : nameNode}
          {performance.recommended && showRecommendation && (
            <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
          )}
        </span>
        <span className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
          {formatClock(performance.startTime, ft)}–{formatClock(performance.endTime, ft)}
          {/* Friends' picks ride on the time line so they fit any block
              height. One tap target over the pointer-events-none layer,
              opening the sheet where their notes are readable. */}
          <CrewBubbles
            friends={friends}
            max={compact ? 2 : 3}
            onOpen={() => marks.openSheet(performance.id)}
            className="ml-1"
          />
        </span>
        {showInlineNote && <InlineNote note={note} lines={noteLines === 2 ? 2 : 1} />}
      </div>

      {/* Icon rail, layered above the button so link taps hit the link, not
          the toggle. The rail is tall (top-1/bottom-1), so the note
          indicator fits right under the star — the transposed block's rail
          isn't tall enough for that, see TransposedPerformanceBlock.tsx. */}
      <div className="pointer-events-none absolute top-1 right-1 bottom-1 z-10 flex flex-col items-center gap-2.5">
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

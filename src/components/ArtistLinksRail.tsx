"use client";

import { Instagram, Spotify } from "@/components/icons";
import type { ArtistLinks } from "@/lib/artist-links";
import type { MarkTier } from "@/hooks/useMarks";
import { markAriaLabel } from "@/lib/marks";

interface ArtistLinksRailProps {
  artistName: string;
  links: ArtistLinks;
  /** Resolved by the caller (marks.tierOf(performance.id)) — this component
   *  stays presentational and doesn't know about performance ids. */
  tier: MarkTier | null;
  /** "vertical" for the tall two-stage grid, "horizontal" for list rows and the transposed grid. */
  orientation: "vertical" | "horizontal";
  /**
   * When given, the star becomes a real button that cycles the tier. The
   * transposed grid needs this because tapping the block body there selects
   * a walking origin instead of cycling; where the body already cycles the
   * tier (the vertical grid, the side-stage list) the star stays a
   * decorative glyph so there aren't two controls doing the same thing.
   */
  onCycle?: () => void;
  /**
   * Drop the streaming icons and keep only the star. A 30-minute set renders
   * at the grid's minimum width, where a full rail would leave about seven
   * characters for the artist name — the name matters more than the icons,
   * and the act's own page is still one tap away via the name link.
   */
  compact?: boolean;
}

// The links are layered ABOVE the block's own full-bleed button and are its
// siblings, never nested inside it — a nested <a> inside a <button> is
// invalid and, more practically, a tap on a link would also fire the button.
// pointer-events are off for the container and back on for each control, so
// the rail itself never steals taps meant for the block.
export function ArtistLinksRail({
  artistName,
  links,
  tier,
  orientation,
  onCycle,
  compact = false,
}: ArtistLinksRailProps) {
  const wrapper =
    orientation === "vertical"
      ? "pointer-events-none absolute top-1 right-1 bottom-1 z-10 flex flex-col items-center gap-2.5"
      : "pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center gap-1.5";

  // must-see keeps the original filled ★ in accent blue; interested is a
  // hollow ☆ in amber; unmarked is the original hollow ★ in dim zinc.
  const glyph = tier === "interested" ? "☆" : "★";
  const glyphColor = tier === "must" ? "text-accent" : tier === "interested" ? "text-interested" : "text-zinc-600";

  return (
    <div className={wrapper}>
      {onCycle ? (
        <button
          type="button"
          onClick={onCycle}
          aria-label={markAriaLabel(artistName, tier)}
          className={`pointer-events-auto p-1.5 text-xs leading-none ${glyphColor}`}
        >
          {glyph}
        </button>
      ) : (
        <span aria-hidden className={`text-xs leading-none ${glyphColor}`}>
          {glyph}
        </span>
      )}

      {!compact && links.spotify && (
        <a
          href={links.spotify}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${artistName} on Spotify`}
          className="pointer-events-auto p-1.5 text-zinc-500 transition-colors hover:text-accent"
        >
          <Spotify className="h-3.5 w-3.5" />
        </a>
      )}
      {!compact && links.instagram && (
        <a
          href={links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${artistName} on Instagram`}
          className="pointer-events-auto p-1.5 text-zinc-500 transition-colors hover:text-accent"
        >
          <Instagram className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

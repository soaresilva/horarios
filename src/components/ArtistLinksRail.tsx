"use client";

import { Instagram, Spotify } from "@/components/icons";
import type { ArtistLinks } from "@/lib/artist-links";

interface ArtistLinksRailProps {
  artistName: string;
  links: ArtistLinks;
  starred: boolean;
  /** "vertical" for the tall two-stage grid, "horizontal" for list rows and the transposed grid. */
  orientation: "vertical" | "horizontal";
  /**
   * When given, the star becomes a real button. The transposed grid needs
   * this because tapping the block body there selects a walking origin
   * instead of starring; where the body already toggles the star (the
   * vertical grid, the side-stage list) the star stays a decorative glyph so
   * there aren't two controls doing the same thing.
   */
  onToggleStar?: () => void;
}

// The links are layered ABOVE the block's own full-bleed button and are its
// siblings, never nested inside it — a nested <a> inside a <button> is
// invalid and, more practically, a tap on a link would also fire the button.
// pointer-events are off for the container and back on for each control, so
// the rail itself never steals taps meant for the block.
export function ArtistLinksRail({
  artistName,
  links,
  starred,
  orientation,
  onToggleStar,
}: ArtistLinksRailProps) {
  const wrapper =
    orientation === "vertical"
      ? "pointer-events-none absolute top-1 right-1 bottom-1 z-10 flex flex-col items-center gap-2.5"
      : "pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center gap-1.5";

  return (
    <div className={wrapper}>
      {onToggleStar ? (
        <button
          type="button"
          onClick={onToggleStar}
          aria-pressed={starred}
          aria-label={`Star ${artistName}`}
          className={`pointer-events-auto p-1.5 text-xs leading-none ${starred ? "text-accent" : "text-zinc-600"}`}
        >
          ★
        </button>
      ) : (
        <span aria-hidden className={`text-xs leading-none ${starred ? "text-accent" : "text-zinc-600"}`}>
          ★
        </span>
      )}

      {links.spotify && (
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
      {links.instagram && (
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

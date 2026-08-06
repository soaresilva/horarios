"use client";

import type { Performance } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";
import type { BlockLayout } from "@/lib/time";
import { Instagram, Spotify, ThumbsUp } from "@/components/icons";
import { getArtistLinks } from "@/lib/artist-links";

interface PerformanceBlockProps {
  performance: Performance;
  layout: BlockLayout;
  alternate: boolean;
  starred: boolean;
  showRecommendation: boolean;
  onToggleStar: (id: string) => void;
}

export function PerformanceBlock({
  performance,
  layout,
  alternate,
  starred,
  showRecommendation,
  onToggleStar,
}: PerformanceBlockProps) {
  const links = getArtistLinks(performance.artistName);

  return (
    <div
      data-performance-id={performance.id}
      style={{ top: layout.top, height: layout.height }}
      className={`absolute left-1 right-1 rounded-md transition-colors ${
        starred
          ? "bg-accent/20 ring-1 ring-accent"
          : alternate
            ? "bg-zinc-800/80"
            : "bg-zinc-800/40"
      }`}
    >
      {/* Fills the whole box: clicking anywhere that isn't a link toggles the star. */}
      <button
        type="button"
        onClick={() => onToggleStar(performance.id)}
        aria-pressed={starred}
        className="absolute inset-0 flex h-full w-full flex-col justify-center rounded-md py-1 pl-2 pr-7 text-left"
      >
        <span className="text-sm leading-tight font-medium text-zinc-100 sm:text-base">
          {performance.artistName}
          {performance.recommended && showRecommendation && (
            <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
          )}
        </span>
        <span className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
          {formatClock(performance.startTime)}–{formatClock(performance.endTime)}
        </span>
      </button>

      {/* Icon rail, layered above the button so link taps hit the link, not the toggle. */}
      <div className="pointer-events-none absolute top-1 right-1 bottom-1 z-10 flex flex-col items-center gap-2.5">
        <span
          aria-hidden
          className={`text-xs leading-none ${starred ? "text-accent" : "text-zinc-600"}`}
        >
          ★
        </span>
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

"use client";

import type { Performance, Stage } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";
import { Instagram, Spotify, ThumbsUp } from "@/components/icons";
import { useShowRecommendations } from "@/hooks/useShowRecommendations";
import { getArtistLinks } from "@/lib/artist-links";

interface SideStageSectionProps {
  stage: Stage;
  performances: Performance[];
  isStarred: (id: string) => boolean;
  onToggleStar: (id: string) => void;
}

// A free/side stage (Jazz na Relva, Xapas Lounge, ...), shown as its own
// section stacked above the main two-stage grid rather than tucked behind a
// separate tab. Its header is `sticky top-0`, same as the main stages'
// header below it — as you scroll past this section, the main stages'
// header naturally takes over the sticky slot, so whichever stage is
// actually on screen is always the one labeled at the top.
export function SideStageSection({ stage, performances, isStarred, onToggleStar }: SideStageSectionProps) {
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
        {sorted.map((performance) => {
          const starred = isStarred(performance.id);
          const links = getArtistLinks(performance.artistName);
          return (
            <li key={performance.id} className="relative">
              {/* Fills the row: clicking anywhere that isn't a link toggles the star. */}
              <button
                type="button"
                onClick={() => onToggleStar(performance.id)}
                aria-pressed={starred}
                className={`flex w-full items-center justify-between gap-2 rounded-md py-2 pl-3 pr-16 text-left ${
                  starred ? "bg-accent/20 ring-1 ring-accent" : "bg-zinc-800/60"
                }`}
              >
                <span className="text-sm font-medium text-zinc-100">
                  {performance.artistName}
                  {performance.recommended && showRecommendations && (
                    <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
                  )}
                </span>
                <span className="text-xs text-zinc-400">
                  {formatClock(performance.startTime)}–{formatClock(performance.endTime)}
                </span>
              </button>

              {/* Icon row, layered above the button so link taps hit the link, not the toggle. */}
              <div className="pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center gap-1.5">
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
        })}
      </ul>
    </div>
  );
}

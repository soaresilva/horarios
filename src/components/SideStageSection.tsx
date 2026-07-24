"use client";

import type { Performance, Stage } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";

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
  const sorted = [...performances].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  if (sorted.length === 0) return null;

  return (
    <div className="mb-1">
      <div className="sticky top-0 z-20 bg-background/95 px-3 py-2 backdrop-blur-sm">
        <span className="text-sm font-semibold text-zinc-200">{stage.name}</span>
      </div>
      <ul className="flex flex-col gap-1.5 px-3 pb-3">
        {sorted.map((performance) => {
          const starred = isStarred(performance.id);
          return (
            <li key={performance.id}>
              <button
                type="button"
                onClick={() => onToggleStar(performance.id)}
                aria-pressed={starred}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left ${
                  starred ? "bg-accent/20 ring-1 ring-accent" : "bg-zinc-800/60"
                }`}
              >
                <span className="text-sm font-medium text-zinc-100">{performance.artistName}</span>
                <span className="flex items-center gap-2 text-xs text-zinc-400">
                  {formatClock(performance.startTime)}–{formatClock(performance.endTime)}
                  <span aria-hidden className={starred ? "text-accent" : "text-zinc-600"}>
                    ★
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

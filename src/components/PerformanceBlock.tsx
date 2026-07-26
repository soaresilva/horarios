"use client";

import type { Performance } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";
import type { BlockLayout } from "@/lib/time";
import { ThumbsUp } from "@/components/icons";

interface PerformanceBlockProps {
  performance: Performance;
  layout: BlockLayout;
  alternate: boolean;
  starred: boolean;
  onToggleStar: (id: string) => void;
}

export function PerformanceBlock({ performance, layout, alternate, starred, onToggleStar }: PerformanceBlockProps) {
  return (
    <button
      type="button"
      onClick={() => onToggleStar(performance.id)}
      aria-pressed={starred}
      style={{ top: layout.top, height: layout.height }}
      className={`absolute left-1 right-1 flex flex-col justify-center rounded-md px-2 py-1 text-left transition-colors ${
        starred
          ? "bg-accent/20 ring-1 ring-accent"
          : alternate
            ? "bg-zinc-800/80"
            : "bg-zinc-800/40"
      }`}
    >
      <span className="flex items-start justify-between gap-1">
        <span className="text-sm leading-tight font-medium text-zinc-100 sm:text-base">
          {performance.artistName}
          {performance.recommended && (
            <ThumbsUp className="ml-1 inline-block h-3 w-3 align-[-0.125em] text-accent" />
          )}
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-xs leading-none ${starred ? "text-accent" : "text-zinc-600"}`}
        >
          ★
        </span>
      </span>
      <span className="text-[10px] leading-tight text-zinc-400 sm:text-xs">
        {formatClock(performance.startTime)}–{formatClock(performance.endTime)}
      </span>
    </button>
  );
}

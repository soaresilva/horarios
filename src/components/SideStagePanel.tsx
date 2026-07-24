"use client";

import { useState } from "react";
import { useNow } from "@/hooks/useNow";
import type { Performance, Stage } from "@/lib/schedule-client";
import { formatClock, isStageOver } from "@/lib/time";

interface SideStagePanelProps {
  stage: Stage;
  performances: Performance[];
  isStarred: (id: string) => boolean;
  onToggleStar: (id: string) => void;
}

// A free/side stage (Jazz na Relva, Xapas Lounge, ...) shown as its own
// collapsible single-column panel above the main two-stage grid, rather
// than tucked behind a separate tab. Auto-collapses once its last act for
// the day has ended, since by then it's no longer relevant and would just
// push the main stages further down the page — but stays manually
// re-openable in case someone wants to check what played.
export function SideStagePanel({ stage, performances, isStarred, onToggleStar }: SideStagePanelProps) {
  const now = useNow(30_000);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);

  const sorted = [...performances].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const autoCollapsed = isStageOver(sorted, now);
  const expanded = manualExpanded ?? !autoCollapsed;

  if (sorted.length === 0) return null;

  return (
    <div className="mx-3 mt-2 mb-1 overflow-hidden rounded-lg bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setManualExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-zinc-200">{stage.name}</span>
        <span className="flex items-center gap-2 text-[10px] text-zinc-500">
          {autoCollapsed && !expanded ? "ended" : `${formatClock(sorted[0].startTime)}–${formatClock(sorted[sorted.length - 1].endTime)}`}
          <span aria-hidden className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </span>
      </button>

      {expanded && (
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
                    starred ? "bg-amber-400/20 ring-1 ring-amber-400" : "bg-zinc-800/60"
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-100">{performance.artistName}</span>
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    {formatClock(performance.startTime)}–{formatClock(performance.endTime)}
                    <span aria-hidden className={starred ? "text-amber-400" : "text-zinc-600"}>
                      ★
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

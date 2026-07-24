"use client";

import type { Performance, Stage } from "@/lib/schedule-client";
import { formatClock } from "@/lib/time";

interface OtherStagesListProps {
  stages: Stage[];
  performances: Performance[];
  isStarred: (id: string) => boolean;
  onToggleStar: (id: string) => void;
}

export function OtherStagesList({ stages, performances, isStarred, onToggleStar }: OtherStagesListProps) {
  return (
    <div className="flex flex-col gap-6 p-3">
      {stages.map((stage) => {
        const stagePerformances = performances
          .filter((p) => p.stageId === stage.id)
          .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

        return (
          <div key={stage.id}>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">{stage.name}</h3>
            <ul className="flex flex-col gap-1.5">
              {stagePerformances.map((performance) => {
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
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { CurrentTimeLine } from "@/components/CurrentTimeLine";
import { PerformanceBlock } from "@/components/PerformanceBlock";
import { TimeAxis } from "@/components/TimeAxis";
import type { Performance, Stage } from "@/lib/schedule-client";
import { blockLayout, computeDayWindow, windowHeight } from "@/lib/time";

interface StageGridProps {
  stages: Stage[];
  performances: Performance[];
  isStarred: (id: string) => boolean;
  onToggleStar: (id: string) => void;
}

export function StageGrid({ stages, performances, isStarred, onToggleStar }: StageGridProps) {
  const window = computeDayWindow(performances);

  if (!window) {
    return <p className="p-4 text-sm text-zinc-500">No performances scheduled for this day yet.</p>;
  }

  const height = windowHeight(window);

  return (
    <div className="flex">
      <TimeAxis window={window} />
      <div className="relative flex flex-1">
        {stages.map((stage, stageIndex) => {
          const stagePerformances = performances
            .filter((p) => p.stageId === stage.id)
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

          return (
            <div
              key={stage.id}
              className={`relative flex-1 ${stageIndex === 0 ? "border-r border-zinc-800" : ""}`}
              style={{ height }}
            >
              {stagePerformances.map((performance, i) => (
                <PerformanceBlock
                  key={performance.id}
                  performance={performance}
                  layout={blockLayout(window, performance)}
                  alternate={i % 2 === 0}
                  starred={isStarred(performance.id)}
                  onToggleStar={onToggleStar}
                />
              ))}
            </div>
          );
        })}
        <CurrentTimeLine window={window} />
      </div>
    </div>
  );
}

"use client";

import { useNow } from "@/hooks/useNow";
import { currentTimeOffset, formatClock, type GridWindow } from "@/lib/time";

export function CurrentTimeLine({ window }: { window: GridWindow }) {
  const now = useNow(30_000);

  if (!now) return null;
  const offset = currentTimeOffset(window, now);
  if (offset === null) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: offset }}>
      <div className="flex items-center">
        <span className="-ml-px rounded bg-red-500 px-1 text-[10px] font-semibold leading-tight text-white">
          {formatClock(now)}
        </span>
        <div className="h-px flex-1 bg-red-500" />
      </div>
    </div>
  );
}

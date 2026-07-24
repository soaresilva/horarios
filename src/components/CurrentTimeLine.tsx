"use client";

import { useEffect, useRef } from "react";
import { useNow } from "@/hooks/useNow";
import { currentTimeOffset, formatClock, type GridWindow } from "@/lib/time";

export function CurrentTimeLine({ window }: { window: GridWindow }) {
  const now = useNow(30_000);
  const lineRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const offset = now ? currentTimeOffset(window, now) : null;

  // Bring "now" into view the first time it's known — the whole point of
  // this line is showing people what's on right now, so they shouldn't have
  // to scroll down through the earlier part of the day to find it. Only
  // fires once per mount (not on every day switch), matching "when someone
  // opens the page" rather than "every time they look at today".
  useEffect(() => {
    if (offset === null || hasScrolledRef.current || !lineRef.current) return;
    hasScrolledRef.current = true;
    lineRef.current.scrollIntoView({ block: "center" });
  }, [offset]);

  if (offset === null) return null;

  return (
    <div ref={lineRef} className="pointer-events-none absolute inset-x-0 z-10" style={{ top: offset }}>
      <div className="flex items-center">
        <span className="-ml-px rounded bg-red-500 px-1 text-[10px] font-semibold leading-tight text-white">
          {formatClock(now!)}
        </span>
        <div className="h-px flex-1 bg-red-500" />
      </div>
    </div>
  );
}

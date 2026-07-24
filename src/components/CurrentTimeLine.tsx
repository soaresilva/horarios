"use client";

import { useEffect, useState } from "react";
import { currentTimeOffset, formatClock, type GridWindow } from "@/lib/time";

export function CurrentTimeLine({ window }: { window: GridWindow }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Deliberately synchronous: `now` starts null so server and first
    // client render match (Next SSRs client components too, and the real
    // server/client clocks would never agree exactly). Setting it right
    // away here, not after a network await, is what gets the line on
    // screen on the same tick as mount instead of one paint later.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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

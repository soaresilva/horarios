"use client";

import { useEffect, useState } from "react";

/**
 * Live clock, ticking every `intervalMs`. Starts `null` so server and first
 * client render match (Next SSRs client components too, and the real
 * server/client clocks would never agree exactly) — consumers should treat
 * `null` as "not yet known" rather than defaulting to some fixed time.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Deliberately synchronous, not after a network await: this is what
    // gets `now` on screen on the same tick as mount instead of one paint
    // later. See react-hooks/set-state-in-effect — this is the recognized
    // exception for state that can only be known on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

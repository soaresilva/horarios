"use client";

import { useCallback, useEffect, useState } from "react";
import { parseSchedule, type Schedule } from "@/lib/schedule-client";

export interface UseScheduleResult {
  schedule: Schedule | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// How often to silently re-fetch while the tab is visible. Bounds how stale
// an already-open tab's data can get between an admin edit and it showing
// up, without hammering the API from every device open during the festival.
const POLL_INTERVAL_MS = 60_000;

export function useSchedule(): UseScheduleResult {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule");
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const dto = await res.json();
      setSchedule(parseSchedule(dto));
      setError(null);
    } catch {
      // Covers both "genuinely offline with nothing cached yet" and any
      // server error; the service worker's NetworkFirst cache is what
      // makes the common offline case (already visited once) succeed here.
      setError("Couldn't load the schedule. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this because `load` eventually
    // calls setState, but only after an `await` — this is the standard
    // fetch-on-mount pattern, not the synchronous setState-during-render
    // the rule exists to catch. A data-fetching library would hide this
    // exact same shape inside itself; writing it by hand for one fetch call
    // doesn't justify the dependency (see CLAUDE.md: vanilla by default).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // A PWA opened from the home screen is typically suspended, not fully
  // reloaded, when backgrounded — so the mount-only fetch above can go
  // hours without re-firing even while the schedule changes underneath it
  // (an edit saved via /admin). Re-fetch whenever the tab regains focus or
  // visibility, and poll on an interval while it stays visible, so an edit
  // shows up within a bounded time instead of only on a hard reload.
  useEffect(() => {
    const refetchIfVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refetchIfVisible);
    window.addEventListener("focus", refetchIfVisible);
    const interval = setInterval(refetchIfVisible, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", refetchIfVisible);
      window.removeEventListener("focus", refetchIfVisible);
      clearInterval(interval);
    };
  }, [load]);

  return { schedule, loading, error, reload: load };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { parseSchedule, type Schedule } from "@/lib/schedule-client";

export interface UseScheduleResult {
  schedule: Schedule | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

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

  return { schedule, loading, error, reload: load };
}

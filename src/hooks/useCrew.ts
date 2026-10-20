"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createCrew, getCrew, joinCrew, leaveCrew, updateMyCrewMember } from "@/app/crew/actions";
import { friendsByPerformance, type FriendMark } from "@/lib/crew";
import type { CrewDTO, CrewResult } from "@/types/crew";
import { useCrewMember, writeCrewMember } from "@/hooks/crewMembership";

// Same cadence as useSchedule's poll: a friend's new pick shows up within a
// minute while the tab is visible, and a backgrounded tab costs nothing.
const POLL_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// The last crew snapshot per festival, in localStorage so bubbles survive a
// reload with no signal at the festival. Cached by its raw JSON string so
// useSyncExternalStore gets the same object back until the content changes.
// ---------------------------------------------------------------------------

export interface CrewSnapshot {
  crew: CrewDTO | null;
  /** ISO time of the last successful fetch, or null before the first one. */
  fetchedAt: string | null;
}

const EMPTY_SNAPSHOT: CrewSnapshot = { crew: null, fetchedAt: null };
const snapshotKey = (slug: string) => `${slug}:crew`;
const snapshotListeners = new Map<string, Set<() => void>>();
const snapshotCache = new Map<string, { raw: string | null; value: CrewSnapshot }>();

function snapshotListenersFor(slug: string) {
  let set = snapshotListeners.get(slug);
  if (!set) {
    set = new Set();
    snapshotListeners.set(slug, set);
  }
  return set;
}

function readSnapshot(slug: string): CrewSnapshot {
  const cached = snapshotCache.get(slug);
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(snapshotKey(slug));
  } catch {
    // Storage blocked: whatever this session wrote is all there is.
    return cached?.value ?? EMPTY_SNAPSHOT;
  }
  if (cached && cached.raw === raw) return cached.value;
  let value = EMPTY_SNAPSHOT;
  if (raw) {
    try {
      value = JSON.parse(raw) as CrewSnapshot;
    } catch {
      value = EMPTY_SNAPSHOT;
    }
  }
  snapshotCache.set(slug, { raw, value });
  return value;
}

function writeSnapshot(slug: string, fresh: CrewDTO | null) {
  // Every poll moves fetchedAt, but when the crew itself is unchanged the
  // old object is kept, so friendsOf keeps its identity and the grid's
  // blocks don't all re-render once a minute for nothing.
  const previous = readSnapshot(slug).crew;
  const crew = previous && fresh && JSON.stringify(previous) === JSON.stringify(fresh) ? previous : fresh;
  const value: CrewSnapshot = { crew, fetchedAt: new Date().toISOString() };
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(snapshotKey(slug), raw);
  } catch {
    // in-memory only for this session
  }
  snapshotCache.set(slug, { raw, value });
  for (const listener of snapshotListenersFor(slug)) listener();
}

function isSyncedHere(slug: string): boolean {
  try {
    return window.localStorage.getItem(`${slug}:synced`) === "true";
  } catch {
    return false;
  }
}

export interface UseCrewResult {
  crew: CrewDTO | null;
  fetchedAt: string | null;
  /** Friends' marks on one set, strongest first; empty when there are none (or crews are off). */
  friendsOf: (performanceId: string) => FriendMark[];
  create: (tag: string) => Promise<CrewResult>;
  join: (code: string, tag: string) => Promise<CrewResult>;
  update: (changes: { tag?: string; shareNotes?: boolean }) => Promise<CrewResult>;
  leave: () => Promise<void>;
}

const NO_FRIENDS: FriendMark[] = [];

export function useCrew(festivalSlug: string, enabled: boolean): UseCrewResult {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const listeners = snapshotListenersFor(festivalSlug);
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    [festivalSlug],
  );
  const getSnapshot = useCallback(() => readSnapshot(festivalSlug), [festivalSlug]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const member = useCrewMember();

  const crew = enabled ? snapshot.crew : null;

  const refresh = useCallback(async () => {
    try {
      const fresh = await getCrew(festivalSlug);
      writeSnapshot(festivalSlug, fresh);
      // The server is the source of truth for membership: a crew joined on
      // a paired phone shows up here, and one left elsewhere goes away.
      writeCrewMember(fresh !== null);
    } catch {
      // Offline or the request failed: keep showing the last snapshot.
    }
  }, [festivalSlug]);

  // Poll only while in a crew. On mount, also check once if this device has
  // a sync cookie for this festival: its paired phone may have joined a crew.
  // Everyone else (no crew, never synced) makes no crew requests at all.
  useEffect(() => {
    if (!enabled) return;
    if (member || isSyncedHere(festivalSlug)) void refresh();
    if (!member) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    const interval = setInterval(refreshIfVisible, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      clearInterval(interval);
    };
  }, [enabled, member, festivalSlug, refresh]);

  const applyResult = useCallback(
    (result: CrewResult): CrewResult => {
      if ("crew" in result) {
        writeSnapshot(festivalSlug, result.crew);
        writeCrewMember(true);
      } else if (result.error === "not-in-crew") {
        writeSnapshot(festivalSlug, null);
        writeCrewMember(false);
      }
      return result;
    },
    [festivalSlug],
  );

  const create = useCallback(
    async (tag: string) => applyResult(await createCrew(festivalSlug, tag)),
    [festivalSlug, applyResult],
  );
  const join = useCallback(
    async (code: string, tag: string) => applyResult(await joinCrew(festivalSlug, code, tag)),
    [festivalSlug, applyResult],
  );
  const update = useCallback(
    async (changes: { tag?: string; shareNotes?: boolean }) => applyResult(await updateMyCrewMember(festivalSlug, changes)),
    [festivalSlug, applyResult],
  );
  const leave = useCallback(async () => {
    await leaveCrew();
    writeSnapshot(festivalSlug, null);
    writeCrewMember(false);
  }, [festivalSlug]);

  const byPerformance = useMemo(() => friendsByPerformance(crew?.members ?? []), [crew]);
  const friendsOf = useCallback((id: string) => byPerformance.get(id) ?? NO_FRIENDS, [byPerformance]);

  return { crew, fetchedAt: enabled ? snapshot.fetchedAt : null, friendsOf, create, join, update, leave };
}

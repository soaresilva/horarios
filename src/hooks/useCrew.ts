"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { createCrew, getCrews, joinCrew, leaveCrew, renameCrew, updateMyCrewMember } from "@/app/crew/actions";
import { crewLabel, friendsByPerformance, type FriendMark } from "@/lib/crew";
import type { CrewDTO, CrewResult, CrewsDTO, FriendDTO } from "@/types/crew";
import { useCrewMember, writeCrewMember } from "@/hooks/crewMembership";

// Same cadence as useSchedule's poll: a friend's new pick shows up within a
// minute while the tab is visible, and a backgrounded tab costs nothing.
const POLL_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Crews switched off in the panel. A display choice for this device, across
// festivals: you stay in the crew and your marks keep going to it, so it's
// plain localStorage and the server never hears about it.
// ---------------------------------------------------------------------------

const HIDDEN_KEY = "crew:hiddenCrews";
const NO_HIDDEN_CREWS: ReadonlySet<string> = new Set();
const hiddenListeners = new Set<() => void>();
let hiddenCache: { raw: string | null; value: ReadonlySet<string> } = { raw: null, value: NO_HIDDEN_CREWS };

function readHiddenCrews(): ReadonlySet<string> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(HIDDEN_KEY);
  } catch {
    return hiddenCache.value;
  }
  if (raw === hiddenCache.raw) return hiddenCache.value;
  let ids: string[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === "string");
  } catch {
    // unreadable: nothing hidden
  }
  hiddenCache = { raw, value: ids.length > 0 ? new Set(ids) : NO_HIDDEN_CREWS };
  return hiddenCache.value;
}

function writeHiddenCrews(ids: ReadonlySet<string>) {
  const raw = ids.size > 0 ? JSON.stringify(Array.from(ids)) : null;
  try {
    if (raw) window.localStorage.setItem(HIDDEN_KEY, raw);
    else window.localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // Storage blocked: hidden for this session only.
  }
  hiddenCache = { raw, value: ids.size > 0 ? new Set(ids) : NO_HIDDEN_CREWS };
  for (const listener of hiddenListeners) listener();
}

function subscribeHidden(onChange: () => void) {
  hiddenListeners.add(onChange);
  return () => {
    hiddenListeners.delete(onChange);
  };
}

// ---------------------------------------------------------------------------
// The last crew snapshot per festival, in localStorage so bubbles survive a
// reload with no signal at the festival. Cached by its raw JSON string so
// useSyncExternalStore gets the same object back until the content changes.
// ---------------------------------------------------------------------------

export interface CrewSnapshot {
  crews: CrewsDTO | null;
  /** ISO time of the last successful fetch, or null before the first one. */
  fetchedAt: string | null;
}

const EMPTY_SNAPSHOT: CrewSnapshot = { crews: null, fetchedAt: null };
const snapshotKey = (slug: string) => `${slug}:crews`;
// The one-crew shape, from before a visitor could be in several. Nothing
// reads it; the first write clears it.
const legacySnapshotKey = (slug: string) => `${slug}:crew`;
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

function writeSnapshot(slug: string, fresh: CrewsDTO | null) {
  // Every poll moves fetchedAt, but when the crews themselves are unchanged
  // the old object is kept, so friendsOf keeps its identity and the grid's
  // blocks don't all re-render once a minute for nothing.
  const previous = readSnapshot(slug).crews;
  const crews = previous && fresh && JSON.stringify(previous) === JSON.stringify(fresh) ? previous : fresh;
  const value: CrewSnapshot = { crews, fetchedAt: new Date().toISOString() };
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(snapshotKey(slug), raw);
    window.localStorage.removeItem(legacySnapshotKey(slug));
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
  /** Your crews, in the order you joined them. */
  crews: CrewDTO[];
  /** Everyone you share a crew with, hidden crews included. */
  friends: FriendDTO[];
  fetchedAt: string | null;
  /** Friends' marks on one set, strongest first; empty when there are none (or crews are off). */
  friendsOf: (performanceId: string) => FriendMark[];
  /** Which of your crews a friend is in, for the sheet; null when you're in only one. */
  crewLabelOf: (friend: FriendMark) => string | null;
  hiddenCrewIds: ReadonlySet<string>;
  toggleCrewHidden: (crewId: string) => void;
  create: (tag: string, name: string) => Promise<CrewResult>;
  join: (code: string, tag: string) => Promise<CrewResult>;
  update: (crewId: string, changes: { tag?: string; shareNotes?: boolean }) => Promise<CrewResult>;
  rename: (crewId: string, name: string) => Promise<CrewResult>;
  leave: (crewId: string) => Promise<void>;
}

const NO_CREWS: CrewDTO[] = [];
const NO_FRIENDS: FriendDTO[] = [];
const NO_MARKS: FriendMark[] = [];

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
  const hiddenCrewIds = useSyncExternalStore(subscribeHidden, readHiddenCrews, () => NO_HIDDEN_CREWS);
  const member = useCrewMember();

  const crews = (enabled ? snapshot.crews?.crews : null) ?? NO_CREWS;
  const friends = (enabled ? snapshot.crews?.friends : null) ?? NO_FRIENDS;

  const store = useCallback(
    (fresh: CrewsDTO | null) => {
      writeSnapshot(festivalSlug, fresh);
      writeCrewMember(fresh !== null);
    },
    [festivalSlug],
  );

  const refresh = useCallback(async () => {
    try {
      // The server is the source of truth for membership: a crew joined on
      // a paired phone shows up here, and one left elsewhere goes away.
      store(await getCrews(festivalSlug));
    } catch {
      // Offline or the request failed: keep showing the last snapshot.
    }
  }, [festivalSlug, store]);

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

  // "not-in-crew" only says the seat in question is gone (left on a paired
  // phone, say), not that every crew is, so it re-reads rather than clearing.
  const applyResult = useCallback(
    (result: CrewResult): CrewResult => {
      if ("crews" in result) store(result.crews.crews.length > 0 ? result.crews : null);
      else if (result.error === "not-in-crew") void refresh();
      return result;
    },
    [store, refresh],
  );

  const create = useCallback(
    async (tag: string, name: string) => applyResult(await createCrew(festivalSlug, tag, name)),
    [festivalSlug, applyResult],
  );
  const join = useCallback(
    async (code: string, tag: string) => applyResult(await joinCrew(festivalSlug, code, tag)),
    [festivalSlug, applyResult],
  );
  const update = useCallback(
    async (crewId: string, changes: { tag?: string; shareNotes?: boolean }) =>
      applyResult(await updateMyCrewMember(festivalSlug, crewId, changes)),
    [festivalSlug, applyResult],
  );
  const rename = useCallback(
    async (crewId: string, name: string) => applyResult(await renameCrew(festivalSlug, crewId, name)),
    [festivalSlug, applyResult],
  );
  const leave = useCallback(
    async (crewId: string) => {
      store(await leaveCrew(festivalSlug, crewId));
      const hidden = readHiddenCrews();
      if (hidden.has(crewId)) writeHiddenCrews(new Set(Array.from(hidden).filter((id) => id !== crewId)));
    },
    [festivalSlug, store],
  );

  const toggleCrewHidden = useCallback((crewId: string) => {
    const next = new Set(readHiddenCrews());
    if (!next.delete(crewId)) next.add(crewId);
    writeHiddenCrews(next);
  }, []);

  const byPerformance = useMemo(() => friendsByPerformance(friends, hiddenCrewIds), [friends, hiddenCrewIds]);
  const friendsOf = useCallback((id: string) => byPerformance.get(id) ?? NO_MARKS, [byPerformance]);

  const crewLabelOf = useCallback(
    (friend: FriendMark) => {
      if (crews.length < 2) return null;
      return crews
        .filter((crew) => friend.crewIds.includes(crew.id))
        .map(crewLabel)
        .join(", ");
    },
    [crews],
  );

  return {
    crews,
    friends,
    fetchedAt: enabled ? snapshot.fetchedAt : null,
    friendsOf,
    crewLabelOf,
    hiddenCrewIds,
    toggleCrewHidden,
    create,
    join,
    update,
    rename,
    leave,
  };
}

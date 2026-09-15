"use client";

import { useCallback, useSyncExternalStore } from "react";

// Slug-scoped like useMarksHintDismissed (see the comment on its
// storageKey) rather than hardcoded to "pdc26:" like useShowRecommendations
// and useInstallBannerDismissed — notes are per-festival, so the
// "display notes" preference should be too. New hook, so it starts out
// right instead of inheriting the two older hooks' debt.
const storageKey = (festivalSlug: string) => `${festivalSlug}:showNotes`;
const listenersBySlug = new Map<string, Set<() => void>>();

function listenersFor(slug: string): Set<() => void> {
  let set = listenersBySlug.get(slug);
  if (!set) {
    set = new Set();
    listenersBySlug.set(slug, set);
  }
  return set;
}

// Defaults to false (hidden): a note stays behind the ✎ tooltip until a
// visitor opts in, so the toggle is a "the two grids grew a new switch"
// change rather than "notes now suddenly render inline for everyone."
function readShow(slug: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(slug)) === "true";
  } catch {
    return false;
  }
}

function setShow(slug: string, next: boolean) {
  try {
    window.localStorage.setItem(storageKey(slug), String(next));
  } catch {
    // localStorage unavailable (private browsing, quota) — the toggle still
    // works for the session, it just won't persist across reloads.
  }
  for (const listener of listenersFor(slug)) listener();
}

// Matches the default (false) so there is no hydration flash between the
// server-rendered markup and the first client render.
function getServerSnapshot(): boolean {
  return false;
}

export interface UseShowNotesResult {
  show: boolean;
  toggle: () => void;
}

export function useShowNotes(festivalSlug: string): UseShowNotesResult {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listeners = listenersFor(festivalSlug);
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    [festivalSlug],
  );
  // Boolean primitive snapshot — Object.is compares by value, so a fresh
  // read every call can't cause the useSyncExternalStore loop an unstable
  // reference would (same reasoning as useMarksHintDismissed).
  const getSnapshot = useCallback(() => readShow(festivalSlug), [festivalSlug]);

  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => setShow(festivalSlug, !readShow(festivalSlug)), [festivalSlug]);

  return { show, toggle };
}

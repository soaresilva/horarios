"use client";

import { useCallback, useSyncExternalStore } from "react";

// Same slug-scoped external-store shape as useShowNotes, with the opposite
// default: the side programme (LOTD's free daytime Official Unofficial) is
// shown until a visitor hides it. Only an explicit "false" hides it, so a
// missing key, a blocked localStorage, or the server render all mean
// "shown" and nothing flashes in after hydration.
const storageKey = (festivalSlug: string) => `${festivalSlug}:showSideProgramme`;
const listenersBySlug = new Map<string, Set<() => void>>();

function listenersFor(slug: string): Set<() => void> {
  let set = listenersBySlug.get(slug);
  if (!set) {
    set = new Set();
    listenersBySlug.set(slug, set);
  }
  return set;
}

function readShow(slug: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(slug)) !== "false";
  } catch {
    return true;
  }
}

function setShow(slug: string, next: boolean) {
  try {
    window.localStorage.setItem(storageKey(slug), String(next));
  } catch {
    // localStorage unavailable (private browsing, quota): works for the
    // session, doesn't persist.
  }
  for (const listener of listenersFor(slug)) listener();
}

function getServerSnapshot(): boolean {
  return true;
}

export interface UseShowSideProgrammeResult {
  show: boolean;
  toggle: () => void;
}

export function useShowSideProgramme(festivalSlug: string): UseShowSideProgrammeResult {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listeners = listenersFor(festivalSlug);
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    [festivalSlug],
  );
  const getSnapshot = useCallback(() => readShow(festivalSlug), [festivalSlug]);

  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => setShow(festivalSlug, !readShow(festivalSlug)), [festivalSlug]);

  return { show, toggle };
}

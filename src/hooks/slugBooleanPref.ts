"use client";

import { useCallback, useSyncExternalStore } from "react";

// A per-festival on/off preference in localStorage, as an external store,
// for the grid's filter switches (side programme, non-concerts). Same
// slug-scoped shape as useShowNotes; factored out so the two switches can't
// drift on storage format or defaults.
//
// Only an explicit "true" or "false" counts as a choice. A missing key, any
// other value, a blocked localStorage and the server render all mean "the
// festival's default", so nothing flashes in or out after hydration for a
// visitor who never touched the switch.

export interface BooleanPref {
  show: boolean;
  toggle: () => void;
}

export function createSlugBooleanPref(name: string) {
  const storageKey = (festivalSlug: string) => `${festivalSlug}:${name}`;
  const listenersBySlug = new Map<string, Set<() => void>>();

  function listenersFor(slug: string): Set<() => void> {
    let set = listenersBySlug.get(slug);
    if (!set) {
      set = new Set();
      listenersBySlug.set(slug, set);
    }
    return set;
  }

  function read(slug: string, defaultShown: boolean): boolean {
    try {
      const stored = window.localStorage.getItem(storageKey(slug));
      return stored === "true" ? true : stored === "false" ? false : defaultShown;
    } catch {
      return defaultShown;
    }
  }

  function write(slug: string, next: boolean) {
    try {
      window.localStorage.setItem(storageKey(slug), String(next));
    } catch {
      // localStorage unavailable (private browsing, quota): works for the
      // session, doesn't persist.
    }
    for (const listener of listenersFor(slug)) listener();
  }

  return function useSlugBooleanPref(festivalSlug: string, defaultShown: boolean): BooleanPref {
    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const listeners = listenersFor(festivalSlug);
        listeners.add(onStoreChange);
        return () => listeners.delete(onStoreChange);
      },
      [festivalSlug],
    );
    const getSnapshot = useCallback(() => read(festivalSlug, defaultShown), [festivalSlug, defaultShown]);
    const getServerSnapshot = useCallback(() => defaultShown, [defaultShown]);

    const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const toggle = useCallback(
      () => write(festivalSlug, !read(festivalSlug, defaultShown)),
      [festivalSlug, defaultShown],
    );
    return { show, toggle };
  };
}

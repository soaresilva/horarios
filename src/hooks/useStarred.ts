"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pdc26:starred";
const listeners = new Set<() => void>();
let cachedIds: string[] | null = null;
const EMPTY_IDS: string[] = [];

function readIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// useSyncExternalStore, not useState+useEffect: localStorage is an external
// store React doesn't own, and this is the API React ships specifically for
// subscribing to one. This store's data can only be read on the client, so
// getServerSnapshot returns empty — same "starts unstarred, syncs after
// mount" trade-off as before, just without the setState-during-effect the
// lint rule (rightly) flags.
//
// Always re-reads localStorage rather than caching after the first read:
// useSyncExternalStore requires a referentially stable return value when
// nothing has changed (or it loops), but "nothing changed" has to be judged
// by content, not by skipping the read entirely — a stale cache here would
// miss edits made through any path other than this module's own setIds.
function getSnapshot(): string[] {
  const fresh = readIds();
  if (cachedIds === null || !idsEqual(cachedIds, fresh)) {
    cachedIds = fresh;
  }
  return cachedIds;
}

// Exported for a regression test — must return a referentially stable
// value, or React warns "getServerSnapshot should be cached" and can loop.
export function getServerSnapshot(): string[] {
  return EMPTY_IDS;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function setIds(next: string[]) {
  cachedIds = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — starring
    // just won't persist across reloads; not worth surfacing an error for.
  }
  for (const listener of listeners) listener();
}

export interface UseStarredResult {
  isStarred: (id: string) => boolean;
  toggle: (id: string) => void;
}

export function useStarred(): UseStarredResult {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    const next = current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
    setIds(next);
  }, []);

  const isStarred = useCallback((id: string) => ids.includes(id), [ids]);

  return { isStarred, toggle };
}

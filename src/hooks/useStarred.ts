"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// Keyed by festival slug, so starring a Rotterdam set doesn't appear in the
// Paredes de Coura archive. Paredes de Coura's slug is literally "pdc26", so
// `${slug}:starred` is byte-identical to the key this used to hardcode and
// existing visitors keep their stars — don't "tidy" the prefix away.
const storageKey = (festivalSlug: string) => `${festivalSlug}:starred`;

// Per-key stores rather than module-level singletons, now that two festivals
// can be open in two tabs.
const listenersByKey = new Map<string, Set<() => void>>();
const cacheByKey = new Map<string, string[]>();
const EMPTY_IDS: string[] = [];

function listenersFor(key: string): Set<() => void> {
  let set = listenersByKey.get(key);
  if (!set) {
    set = new Set();
    listenersByKey.set(key, set);
  }
  return set;
}

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
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
function getSnapshotFor(key: string): string[] {
  const fresh = readIds(key);
  const cached = cacheByKey.get(key);
  if (!cached || !idsEqual(cached, fresh)) {
    cacheByKey.set(key, fresh);
    return fresh;
  }
  return cached;
}

// Exported for a regression test — must return a referentially stable
// value, or React warns "getServerSnapshot should be cached" and can loop.
export function getServerSnapshot(): string[] {
  return EMPTY_IDS;
}

function setIds(key: string, next: string[]) {
  cacheByKey.set(key, next);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — starring
    // just won't persist across reloads; not worth surfacing an error for.
  }
  for (const listener of listenersFor(key)) listener();
}

// Exported for useFavoritesSync.ts, so it can read/overwrite localStorage
// (to push to the server, and after a pull/pairing-redeem) without reaching
// into this module's private cache/listener state directly. Purely
// additive — every existing caller and test of this hook is unaffected.
export function getIds(festivalSlug: string): string[] {
  return readIds(storageKey(festivalSlug));
}

export function replaceAll(festivalSlug: string, ids: string[]): void {
  setIds(storageKey(festivalSlug), ids);
}

export interface UseStarredResult {
  isStarred: (id: string) => boolean;
  toggle: (id: string) => void;
}

export function useStarred(festivalSlug: string): UseStarredResult {
  const key = storageKey(festivalSlug);

  // subscribe and getSnapshot must be memoised on the key: useSyncExternalStore
  // re-subscribes whenever `subscribe`'s identity changes, so inline arrows
  // here would resubscribe every render.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listeners = listenersFor(key);
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    [key],
  );
  const getSnapshot = useCallback(() => getSnapshotFor(key), [key]);

  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(
    (id: string) => {
      const current = getSnapshotFor(key);
      const next = current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
      setIds(key, next);
    },
    [key],
  );

  const isStarred = useCallback((id: string) => ids.includes(id), [ids]);

  return useMemo(() => ({ isStarred, toggle }), [isStarred, toggle]);
}

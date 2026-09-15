"use client";

import { useCallback, useSyncExternalStore } from "react";

// Same shape as useInstallBannerDismissed's store, but keyed by festival
// slug rather than hardcoded to "pdc26:" — the two existing dismissal hooks
// (useInstallBannerDismissed, useShowRecommendations) are still hardcoded
// that way, and their prefix is deliberately left alone: changing it would
// re-show those banners to every visitor who already dismissed them. This
// hook is new, so it starts out right instead of inheriting that debt.
const storageKey = (festivalSlug: string) => `${festivalSlug}:marksHintDismissed`;
const listenersBySlug = new Map<string, Set<() => void>>();

function listenersFor(slug: string): Set<() => void> {
  let set = listenersBySlug.get(slug);
  if (!set) {
    set = new Set();
    listenersBySlug.set(slug, set);
  }
  return set;
}

// Defaults to false (not dismissed) when nothing is stored, so a first-time
// visitor sees the hint. There is no un-dismiss affordance — once dismissed
// (by tapping it, or by the visitor cycling a tier / opening the sheet on
// their own) it's permanent for that festival.
function readDismissed(slug: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(slug)) === "true";
  } catch {
    return false;
  }
}

function setDismissed(slug: string) {
  try {
    window.localStorage.setItem(storageKey(slug), "true");
  } catch {
    // localStorage unavailable (private browsing, quota) — dismissal only
    // lasts the session; not worth surfacing an error for.
  }
  for (const listener of listenersFor(slug)) listener();
}

function getServerSnapshot(): boolean {
  return false;
}

export interface UseMarksHintDismissedResult {
  dismissed: boolean;
  dismiss: () => void;
}

export function useMarksHintDismissed(festivalSlug: string): UseMarksHintDismissedResult {
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
  // reference would (same reasoning as useInstallBannerDismissed).
  const getSnapshot = useCallback(() => readDismissed(festivalSlug), [festivalSlug]);

  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismiss = useCallback(() => setDismissed(festivalSlug), [festivalSlug]);

  return { dismissed, dismiss };
}

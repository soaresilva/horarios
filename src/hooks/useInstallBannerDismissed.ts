"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pdc26:installBannerDismissed";
const listeners = new Set<() => void>();

// Defaults to false (not dismissed) when nothing is stored, so a first-time
// visitor sees the install banner. There is no un-dismiss affordance — once
// dismissed it's permanent, so unlike useShowRecommendations this store is
// one-way.
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

// Boolean primitive snapshot — Object.is compares by value, so a fresh read
// every call can't cause the useSyncExternalStore loop an unstable reference
// would (same reasoning as useShowRecommendations.getSnapshot).
function getSnapshot(): boolean {
  return readDismissed();
}

function getServerSnapshot(): boolean {
  return false;
}

function setDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable (private browsing, quota) — dismissal only
    // lasts the session; not worth surfacing an error for.
  }
  for (const listener of listeners) listener();
}

export interface UseInstallBannerDismissedResult {
  dismissed: boolean;
  dismiss: () => void;
}

export function useInstallBannerDismissed(): UseInstallBannerDismissedResult {
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismiss = useCallback(() => setDismissed(), []);
  return { dismissed, dismiss };
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "pdc26:showRecommendations";
const listeners = new Set<() => void>();

// Defaults to true (recommendations shown) when nothing is stored yet, so a
// first-time visitor sees the "bolachas recommends" markers until they opt
// out. Any stored value other than the literal "false" is treated as shown.
function readValue(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

// Unlike useStarred (whose snapshot is an array that must be reference-stable
// via caching), this snapshot is a boolean primitive — Object.is compares it
// by value, so returning a fresh read each call can't loop.
function getSnapshot(): boolean {
  return readValue();
}

function getServerSnapshot(): boolean {
  return true;
}

function setValue(next: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // localStorage unavailable (private browsing, quota) — the toggle still
    // works for the session, it just won't persist across reloads.
  }
  for (const listener of listeners) listener();
}

export interface UseShowRecommendationsResult {
  show: boolean;
  toggle: () => void;
}

export function useShowRecommendations(): UseShowRecommendationsResult {
  const show = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(() => setValue(!readValue()), []);
  return { show, toggle };
}

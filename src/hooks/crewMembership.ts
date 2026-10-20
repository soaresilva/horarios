"use client";

import { useSyncExternalStore } from "react";

// "Is this device in a crew": one global flag, not per festival, because a
// crew spans festivals. useFavoritesSync reads it to switch sync on for any
// crew-enabled festival this device opens, which is what puts its marks
// where crewmates can see them. Kept apart from useCrew.ts, which imports
// the crew Server Actions, so useFavoritesSync doesn't pull those in.

const MEMBER_KEY = "crew:member";
const memberListeners = new Set<() => void>();

export function readCrewMember(): boolean {
  try {
    return window.localStorage.getItem(MEMBER_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeCrewMember(value: boolean) {
  try {
    if (value) window.localStorage.setItem(MEMBER_KEY, "true");
    else window.localStorage.removeItem(MEMBER_KEY);
  } catch {
    // localStorage unavailable: the crew still shows on this festival through
    // useCrew's snapshot, it just isn't remembered for other festivals.
  }
  for (const listener of memberListeners) listener();
}

function subscribeMember(onChange: () => void) {
  memberListeners.add(onChange);
  return () => {
    memberListeners.delete(onChange);
  };
}

export function useCrewMember(): boolean {
  return useSyncExternalStore(subscribeMember, readCrewMember, () => false);
}

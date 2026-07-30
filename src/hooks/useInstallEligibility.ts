"use client";

import { useSyncExternalStore } from "react";

export type Platform = "ios" | "android" | "unknown";

export interface InstallEligibility {
  standalone: boolean;
  platform: Platform;
}

// iPadOS 13+ reports navigator.platform as "MacIntel" with no distinct iPad
// token in the UA string; multi-touch support is the standard heuristic to
// still catch it as iOS. Pragmatic, not exhaustive — a rare miss here just
// falls into the "unknown" (both-instructions) branch, which is still correct.
function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "unknown";
}

// navigator.standalone is iOS Safari's own non-standard flag (not in TS's DOM
// types, hence the cast) — display-mode: standalone doesn't cover iOS Safari.
// matchMedia is the standard check everyone else (incl. Chrome/Android) honours.
function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return iosStandalone || mediaStandalone;
}

function computeEligibility(): InstallEligibility {
  return { standalone: isStandalone(), platform: detectPlatform() };
}

// No listeners Set / notify: platform and standalone-ness don't change during
// a session (a user isn't going to install the PWA and have it re-launch
// standalone without a fresh page load), so there's nothing to subscribe to
// beyond the one hydration-mismatch re-render useSyncExternalStore already
// gives for free (see getServerSnapshot below).
function subscribe(): () => void {
  return () => {};
}

// Cache the last returned object and only replace it when the computed
// values actually differ, so an unchanged read keeps a referentially stable
// result — required by useSyncExternalStore, same reasoning as useStarred's
// idsEqual-gated cache.
let cached: InstallEligibility | null = null;

function getSnapshot(): InstallEligibility {
  const next = computeEligibility();
  if (!cached || cached.standalone !== next.standalone || cached.platform !== next.platform) {
    cached = next;
  }
  return cached;
}

// Server (and the client's first, hydration-matching render) can't read
// navigator/matchMedia, so this reports "standalone" — the safe default that
// keeps InstallBanner hidden until the real client-side read resolves on the
// very next paint. This is the opposite default from useStarred/
// useShowRecommendations (which default toward the friendlier *visible*
// state): the risky flash to avoid here is "banner appears then vanishes" for
// already-installed visitors, which is worse than "appears one tick late" for
// everyone else.
const SERVER_SNAPSHOT: InstallEligibility = { standalone: true, platform: "unknown" };

function getServerSnapshot(): InstallEligibility {
  return SERVER_SNAPSHOT;
}

export function useInstallEligibility(): InstallEligibility {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

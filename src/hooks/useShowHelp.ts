"use client";

import { createSlugBooleanPref, type BooleanPref } from "@/hooks/slugBooleanPref";

export type UseShowHelpResult = BooleanPref;

// The help switch: the "tap a set to mark it" strip, the ★/☆ legend with its
// "tap to change" hint, and the how-to sentences of each edition's
// disclaimer (FestivalCopy.help). Shown by default so a first-time visitor
// still gets the explainer; a visitor who knows the gestures switches it off
// per festival.
const useHelpPref = createSlugBooleanPref("showHelp");

export function useShowHelp(festivalSlug: string): UseShowHelpResult {
  return useHelpPref(festivalSlug, true);
}

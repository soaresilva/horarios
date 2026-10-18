"use client";

import { createSlugBooleanPref, type BooleanPref } from "@/hooks/slugBooleanPref";

export type UseShowHelpResult = BooleanPref;

// The help switch: the "tap a set to mark it" strip, the ★/☆ legend with its
// "tap to change" hint, and the how-to sentences of each edition's
// disclaimer (FestivalCopy.help). Shown by default so a first-time visitor
// still gets the explainer; a visitor who knows the gestures switches it off
// once for every festival. Unlike the other switches this one is about the
// visitor, not the edition, so it shares one storage key ("app:showHelp")
// instead of being scoped by festival slug.
const useHelpPref = createSlugBooleanPref("showHelp");

const SHARED_SCOPE = "app";

export function useShowHelp(): UseShowHelpResult {
  return useHelpPref(SHARED_SCOPE, true);
}

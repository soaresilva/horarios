"use client";

import { createSlugBooleanPref, type BooleanPref } from "@/hooks/slugBooleanPref";

export type UseShowSideProgrammeResult = BooleanPref;

// The side-programme switch (LOTD's free daytime Official Unofficial, Le
// Guess Who?'s U?). The default is the festival's call
// (ProgrammeCopy.side.defaultShown in src/lib/festival-copy.ts): TOUO is
// shown until hidden, U? is hidden until shown.
const useSideProgrammePref = createSlugBooleanPref("showSideProgramme");

export function useShowSideProgramme(festivalSlug: string, defaultShown = true): UseShowSideProgrammeResult {
  return useSideProgrammePref(festivalSlug, defaultShown);
}

// The non-concerts switch: films, talks, workshops, exhibitions and other
// non-music items (Performance.kind !== CONCERT). Only rendered for a
// festival that has any.
const useNonConcertsPref = createSlugBooleanPref("showNonConcerts");

export function useShowNonConcerts(festivalSlug: string, defaultShown = true): BooleanPref {
  return useNonConcertsPref(festivalSlug, defaultShown);
}

// The list view's "crew picks" switch: also list sets only crewmates marked
// (FavoritesListView). Off by default, so the itinerary stays strictly
// yours until you ask to see everyone's.
const useCrewSetsPref = createSlugBooleanPref("showCrewSets");

export function useShowCrewSets(festivalSlug: string): BooleanPref {
  return useCrewSetsPref(festivalSlug, false);
}

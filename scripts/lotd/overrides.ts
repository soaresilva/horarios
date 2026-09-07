import type { ParsedAct, ParsedShow } from "../../src/lib/lotd-parse";

/**
 * Corrections for acts whose OWN page on leftofthedial.nl is wrong, verified
 * against the festival's official master timetable PDF
 * (leftofthedial.nl/wp-content/uploads/2026/09/LOTD-TIMETABLE-2026-SEP.pdf).
 *
 * This isn't a scrape bug: fetching these acts' pages directly confirms the
 * site itself publishes the wrong shows. Found 2026-09-07 — Trip Westerns'
 * page duplicated Turnspit's real slots (Thu Annabel Down 23:30, Fri
 * Remastered 19:20), and Tracey Nelson's page showed Trip Westerns' real
 * slots (Thu TR Foyer 20:50, Fri Baanhof 22:20) instead of her own. A closed
 * 3-way mixup: Turnspit's own page was the only one of the three that was
 * actually correct.
 *
 * Overrides apply on every `--fetch`, not just once, since this importer is
 * built to be re-run before the festival (see import-lotd.ts's header
 * comment) and the site itself hasn't been corrected — a plain hand-edit of
 * the committed snapshot would be silently clobbered by the next fetch.
 *
 * Remove an entry once leftofthedial.nl's own page for that act is fixed —
 * re-run `--fetch`, diff the snapshot, and confirm the parsed value now
 * matches this override before deleting it.
 */
export const SHOW_OVERRIDES: Record<string, ParsedShow[]> = {
  "trip-westerns-uk": [
    { day: "THURSDAY", venue: "TR FOYER", time: "20:50" },
    { day: "FRIDAY", venue: "BAANHOF", time: "22:20" },
  ],
  "tracey-nelson-us": [
    { day: "THURSDAY", venue: "ARMINIUS UP", time: "19:40" },
    { day: "FRIDAY", venue: "SALSABILITY", time: "22:00" },
  ],
};

/** Applies SHOW_OVERRIDES over a freshly-parsed act list, replacing `shows` wholesale for any matching slug. */
export function applyShowOverrides(acts: ParsedAct[]): ParsedAct[] {
  return acts.map((act) => {
    const override = SHOW_OVERRIDES[act.slug];
    return override ? { ...act, shows: override } : act;
  });
}

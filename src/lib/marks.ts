import { z } from "zod";

// A visitor can write at most this many characters into a set's note. Kept
// small on purpose — this is "front left, get there early", not a diary —
// and enforced both by the <textarea maxLength> in MarkSheet.tsx and here,
// since the textarea's limit is just a UI nicety a direct Server Action call
// would skip entirely.
export const NOTE_MAX_LENGTH = 280;

// The one shape both sides of the favorites/marks Server Action boundary
// agree on: the client store (useMarks.ts), the sync hook
// (useFavoritesSync.ts) and the actions themselves (favorites/actions.ts) all
// import this instead of redeclaring it three times.
export interface MarksPayload {
  mustSee: string[];
  interested: string[];
  notes: Record<string, string>;
}

// Validated at the action boundary, not trusted from the client: this checks
// the *shape* (every id and note is really a string). Length is handled
// separately by clampMarksPayload below — notes are the first free text a
// visitor can send to this app's server, so the length cap has to be
// enforced server-side rather than relying on the textarea's own maxLength,
// which a direct call bypasses entirely.
export const marksPayloadSchema = z.object({
  mustSee: z.array(z.string()),
  interested: z.array(z.string()),
  notes: z.record(z.string(), z.string()),
});

// Truncates rather than rejects: a note a hair over the limit (e.g. a client
// running slightly-stale JS with a laxer old limit) still gets stored, just
// shortened, instead of failing the whole sync and losing an unrelated tier
// change bundled in the same payload.
export function clampMarksPayload(payload: MarksPayload): MarksPayload {
  const notes: Record<string, string> = {};
  for (const [id, note] of Object.entries(payload.notes)) {
    notes[id] = note.slice(0, NOTE_MAX_LENGTH);
  }
  return { mustSee: payload.mustSee, interested: payload.interested, notes };
}

export const EMPTY_MARKS_PAYLOAD: MarksPayload = { mustSee: [], interested: [], notes: {} };

// How many lines of note a vertical-grid block of this pixel height (its
// `layout.extent`, the same number PerformanceBlock already positions
// itself with) can hold before the note would spill past the block's own
// bottom edge. Derived from the block's content box, not measured from the
// DOM: artist name (`sm:text-base`, `leading-tight`) is 20px, the times line
// (`sm:text-xs`) is 15px, the button's `py-1` adds 8px top+bottom — 43px of
// content that's already there regardless of the toggle — and each note line
// at `text-[10px] leading-snug` is ~14px. A pure function of one number, so
// the boundary cases are pinned by a table instead of eyeballed off a
// screenshot.
export function inlineNoteLines(extent: number): 0 | 1 | 2 {
  if (extent >= 74) return 2;
  if (extent >= 58) return 1;
  return 0;
}

// A cycling control (the block body, the rail star) is a tri-state, not a
// toggle, so `aria-pressed` (which is strictly boolean/mixed) can't
// faithfully describe it — an `aria-label` naming the current state is what
// screen readers get instead. One helper, used by every block/rail that
// cycles a tier, so the wording can't drift between them.
export function markAriaLabel(artistName: string, tier: "must" | "interested" | null): string {
  const state = tier === "must" ? "must-see" : tier === "interested" ? "interested" : "unmarked";
  return `Mark ${artistName}: ${state}, tap to change`;
}

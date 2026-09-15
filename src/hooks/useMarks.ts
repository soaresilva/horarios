"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { MarksPayload } from "@/lib/marks";

// Keyed by festival slug, so marking a Rotterdam set doesn't appear in the
// Paredes de Coura archive. Paredes de Coura's slug is literally "pdc26", so
// `${slug}:starred` is byte-identical to the key this used to hardcode (back
// when there was only one tier, in useStarred.ts) and existing visitors keep
// their stars — don't "tidy" the prefix away. The key name and its
// `string[]` shape are unchanged on purpose: it now means "must-see" instead
// of the old undifferentiated "starred", but every existing array reads back
// correctly with zero migration code.
const mustSeeKey = (festivalSlug: string) => `${festivalSlug}:starred`;
const interestedKey = (festivalSlug: string) => `${festivalSlug}:interested`;
const notesKey = (festivalSlug: string) => `${festivalSlug}:notes`;

export type MarkTier = "must" | "interested";

interface MarksState {
  mustSee: string[];
  interested: string[];
  notes: Record<string, string>;
}

// Per-slug stores rather than module-level singletons, now that two
// festivals can be open in two tabs.
const listenersBySlug = new Map<string, Set<() => void>>();
const cacheBySlug = new Map<string, MarksState>();
const EMPTY_IDS: string[] = [];
const EMPTY_NOTES: Record<string, string> = {};
const EMPTY_STATE: MarksState = { mustSee: EMPTY_IDS, interested: EMPTY_IDS, notes: EMPTY_NOTES };

function listenersFor(slug: string): Set<() => void> {
  let set = listenersBySlug.get(slug);
  if (!set) {
    set = new Set();
    listenersBySlug.set(slug, set);
  }
  return set;
}

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readNotes(key: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function notesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function statesEqual(a: MarksState, b: MarksState): boolean {
  return idsEqual(a.mustSee, b.mustSee) && idsEqual(a.interested, b.interested) && notesEqual(a.notes, b.notes);
}

function readState(slug: string): MarksState {
  return {
    mustSee: readIds(mustSeeKey(slug)),
    interested: readIds(interestedKey(slug)),
    notes: readNotes(notesKey(slug)),
  };
}

// useSyncExternalStore, not useState+useEffect: localStorage is an external
// store React doesn't own, and this is the API React ships specifically for
// subscribing to one. This store's data can only be read on the client, so
// getServerSnapshot returns empty — same "starts unmarked, syncs after
// mount" trade-off as before, just without the setState-during-effect the
// lint rule (rightly) flags.
//
// Always re-reads localStorage rather than caching after the first read:
// useSyncExternalStore requires a referentially stable return value when
// nothing has changed (or it loops), but "nothing changed" has to be judged
// by content, not by skipping the read entirely — a stale cache here would
// miss edits made through any path other than this module's own setState.
function getSnapshotFor(slug: string): MarksState {
  const fresh = readState(slug);
  const cached = cacheBySlug.get(slug);
  if (!cached || !statesEqual(cached, fresh)) {
    cacheBySlug.set(slug, fresh);
    return fresh;
  }
  return cached;
}

// Exported for a regression test — must return a referentially stable
// value, or React warns "getServerSnapshot should be cached" and can loop.
export function getServerSnapshot(): MarksState {
  return EMPTY_STATE;
}

function setState(slug: string, next: MarksState) {
  cacheBySlug.set(slug, next);
  try {
    window.localStorage.setItem(mustSeeKey(slug), JSON.stringify(next.mustSee));
    window.localStorage.setItem(interestedKey(slug), JSON.stringify(next.interested));
    if (Object.keys(next.notes).length > 0) {
      window.localStorage.setItem(notesKey(slug), JSON.stringify(next.notes));
    } else {
      window.localStorage.removeItem(notesKey(slug));
    }
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — marking
    // just won't persist across reloads; not worth surfacing an error for.
  }
  for (const listener of listenersFor(slug)) listener();
}

// Exported for useFavoritesSync.ts, so it can read/overwrite localStorage
// (to push to the server, and after a pull/pairing-redeem) without reaching
// into this module's private cache/listener state directly. Purely
// additive — every existing caller and test of this hook is unaffected.
export function getMarks(festivalSlug: string): MarksPayload {
  const state = readState(festivalSlug);
  return { mustSee: state.mustSee, interested: state.interested, notes: state.notes };
}

export function replaceAllMarks(festivalSlug: string, payload: MarksPayload): void {
  setState(festivalSlug, { mustSee: payload.mustSee, interested: payload.interested, notes: payload.notes });
}

export interface MarkView {
  tierOf: (id: string) => MarkTier | null;
  noteOf: (id: string) => string;
  /** null → must → interested → null. */
  cycle: (id: string) => void;
  setTier: (id: string, tier: MarkTier | null) => void;
  setNote: (id: string, text: string) => void;
}

// What the block/grid layer needs, on top of the raw mark state: a way to
// open MarkSheet for a given performance. Built once in TimetableApp
// (wrapping useFavoritesSync's MarkView with an openSheet callback) and
// threaded down as a single `marks` prop everywhere that used to take the
// isStarred/onToggleStar pair — StageGrid, SideStageSection, TransposedGrid,
// PerformanceBlock, TransposedPerformanceBlock, FavoritesListView.
export interface MarkControls extends MarkView {
  openSheet: (id: string) => void;
  /** "display notes" is on: blocks render the note inline instead of behind the ✎ tooltip. */
  showNotes: boolean;
}

function tierOfIn(state: MarksState, id: string): MarkTier | null {
  if (state.mustSee.includes(id)) return "must";
  if (state.interested.includes(id)) return "interested";
  return null;
}

// Invariant enforced here, the store's only setter of tier: an id appears in
// at most one of mustSee / interested. Notes are independent of tier — a
// note can exist for an id that carries neither.
function withTier(state: MarksState, id: string, tier: MarkTier | null): MarksState {
  const mustSee = state.mustSee.filter((existing) => existing !== id);
  const interested = state.interested.filter((existing) => existing !== id);
  if (tier === "must") mustSee.push(id);
  else if (tier === "interested") interested.push(id);
  return { ...state, mustSee, interested };
}

function withNote(state: MarksState, id: string, text: string): MarksState {
  const notes = { ...state.notes };
  if (text === "") delete notes[id];
  else notes[id] = text;
  return { ...state, notes };
}

export function useMarks(festivalSlug: string): MarkView {
  // subscribe and getSnapshot must be memoised on the slug:
  // useSyncExternalStore re-subscribes whenever `subscribe`'s identity
  // changes, so inline arrows here would resubscribe every render.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const listeners = listenersFor(festivalSlug);
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    [festivalSlug],
  );
  const getSnapshot = useCallback(() => getSnapshotFor(festivalSlug), [festivalSlug]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const cycle = useCallback(
    (id: string) => {
      const current = getSnapshotFor(festivalSlug);
      const currentTier = tierOfIn(current, id);
      const nextTier: MarkTier | null = currentTier === null ? "must" : currentTier === "must" ? "interested" : null;
      setState(festivalSlug, withTier(current, id, nextTier));
    },
    [festivalSlug],
  );

  const setTier = useCallback(
    (id: string, tier: MarkTier | null) => {
      const current = getSnapshotFor(festivalSlug);
      setState(festivalSlug, withTier(current, id, tier));
    },
    [festivalSlug],
  );

  const setNote = useCallback(
    (id: string, text: string) => {
      const current = getSnapshotFor(festivalSlug);
      setState(festivalSlug, withNote(current, id, text));
    },
    [festivalSlug],
  );

  const tierOf = useCallback((id: string) => tierOfIn(state, id), [state]);
  const noteOf = useCallback((id: string) => state.notes[id] ?? "", [state]);

  return useMemo(() => ({ tierOf, noteOf, cycle, setTier, setNote }), [tierOf, noteOf, cycle, setTier, setNote]);
}

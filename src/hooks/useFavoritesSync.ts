"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getMarks, replaceAllMarks, useMarks, type MarkView } from "@/hooks/useMarks";
import {
  generatePairingCode,
  listMarks,
  optIntoSync,
  redeemPairingCode,
  syncMarks,
} from "@/app/favorites/actions";

// Debounce window before an edit gets pushed to the server. Long enough
// that flipping several marks in a row (browsing a day's lineup) sends one
// request instead of one per tap; short enough that a visitor who closes the
// tab a couple seconds later has still synced.
const PUSH_DEBOUNCE_MS = 2000;

const syncedListeners = new Map<string, Set<() => void>>();

function syncedKey(festivalSlug: string) {
  return `${festivalSlug}:synced`;
}

// A device with unpushed local edits: steady-state sync is a full-payload
// replace (see syncMarks in src/app/favorites/actions.ts), so on
// reconnect/remount this device must PUSH its payload rather than PULL and
// clobber its own unsynced edit with a now-stale server copy. Name unchanged
// from the single-tier days — it now covers a tier change on either list OR
// a note edit, not just a star toggle, but "any of the three is unpushed"
// is still exactly one bit.
function dirtyKey(festivalSlug: string) {
  return `${festivalSlug}:starred:dirty`;
}

function listenersFor(festivalSlug: string): Set<() => void> {
  let set = syncedListeners.get(festivalSlug);
  if (!set) {
    set = new Set();
    syncedListeners.set(festivalSlug, set);
  }
  return set;
}

function readSynced(festivalSlug: string): boolean {
  try {
    return window.localStorage.getItem(syncedKey(festivalSlug)) === "true";
  } catch {
    return false;
  }
}

function writeSynced(festivalSlug: string, value: boolean) {
  try {
    window.localStorage.setItem(syncedKey(festivalSlug), String(value));
  } catch {
    // localStorage unavailable — sync just won't persist across reloads,
    // same trade-off useMarks already accepts.
  }
  for (const listener of listenersFor(festivalSlug)) listener();
}

function readDirty(festivalSlug: string): boolean {
  try {
    return window.localStorage.getItem(dirtyKey(festivalSlug)) === "true";
  } catch {
    return false;
  }
}

function writeDirty(festivalSlug: string, value: boolean) {
  try {
    if (value) window.localStorage.setItem(dirtyKey(festivalSlug), "true");
    else window.localStorage.removeItem(dirtyKey(festivalSlug));
  } catch {
    // best-effort — worst case is one redundant push/pull later
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export type RedeemResult = { error: "invalid" | "expired" } | { ok: true };

export interface UseFavoritesSyncResult extends MarkView {
  synced: boolean;
  startSync: () => Promise<void>;
  generateCode: () => Promise<{ code: string; expiresAt: string } | { error: string }>;
  redeemCode: (code: string) => Promise<RedeemResult>;
}

export function useFavoritesSync(festivalSlug: string): UseFavoritesSyncResult {
  const { tierOf, noteOf, cycle: cycleLocal, setTier: setTierLocal, setNote: setNoteLocal } = useMarks(festivalSlug);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const getSnapshot = useCallback(() => readSynced(festivalSlug), [festivalSlug]);
  const synced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const push = useCallback(async () => {
    if (!readSynced(festivalSlug)) return;
    try {
      await syncMarks(festivalSlug, getMarks(festivalSlug));
      writeDirty(festivalSlug, false);
    } catch {
      // Offline or the request failed — stays dirty, retried on the next
      // mount or `online` event. Never surfaced as an error: marking must
      // keep feeling instant and reliable even with no connectivity.
    }
  }, [festivalSlug]);

  const pull = useCallback(async () => {
    if (!readSynced(festivalSlug) || readDirty(festivalSlug)) return;
    try {
      const server = await listMarks(festivalSlug);
      if (server !== null) replaceAllMarks(festivalSlug, server);
    } catch {
      // Offline or the request failed — this device just keeps showing
      // whatever it last had; the next successful pull/push reconciles it.
    }
  }, [festivalSlug]);

  const flush = useCallback(() => {
    if (!readSynced(festivalSlug)) return;
    if (readDirty(festivalSlug)) void push();
    else void pull();
  }, [festivalSlug, push, pull]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);

  // Shared tail of every local edit: mark dirty (if opted into sync) and
  // (re)start the push debounce. The optimistic local write itself already
  // happened synchronously inside cycleLocal/setTierLocal/setNoteLocal by
  // the time this runs, which is what keeps marking instant on bad
  // festival-grounds signal.
  const scheduleDirtyPush = useCallback(() => {
    if (!readSynced(festivalSlug)) return;
    writeDirty(festivalSlug, true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void push();
    }, PUSH_DEBOUNCE_MS);
  }, [festivalSlug, push]);

  const cycle = useCallback(
    (id: string) => {
      cycleLocal(id);
      scheduleDirtyPush();
    },
    [cycleLocal, scheduleDirtyPush],
  );

  const setTier = useCallback(
    (id: string, tier: Parameters<MarkView["setTier"]>[1]) => {
      setTierLocal(id, tier);
      scheduleDirtyPush();
    },
    [setTierLocal, scheduleDirtyPush],
  );

  const setNote = useCallback(
    (id: string, text: string) => {
      setNoteLocal(id, text);
      scheduleDirtyPush();
    },
    [setNoteLocal, scheduleDirtyPush],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const startSync = useCallback(async () => {
    await optIntoSync(festivalSlug, getMarks(festivalSlug));
    writeSynced(festivalSlug, true);
    writeDirty(festivalSlug, false);
  }, [festivalSlug]);

  const generateCodeAction = useCallback(async () => {
    if (!readSynced(festivalSlug)) await startSync();
    return generatePairingCode();
  }, [festivalSlug, startSync]);

  const redeemCode = useCallback(
    async (code: string): Promise<RedeemResult> => {
      const result = await redeemPairingCode(code, festivalSlug, getMarks(festivalSlug));
      if ("error" in result) return result;
      replaceAllMarks(festivalSlug, result);
      writeSynced(festivalSlug, true);
      writeDirty(festivalSlug, false);
      return { ok: true };
    },
    [festivalSlug],
  );

  return { tierOf, noteOf, cycle, setTier, setNote, synced, startSync, generateCode: generateCodeAction, redeemCode };
}

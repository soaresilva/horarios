import type { MarksPayload } from "@/lib/marks";

// Union of a device's local marks with the server's, used exactly once per
// pairing (see redeemPairingCode in src/app/favorites/actions.ts) so neither
// side's pre-pairing state is silently discarded. Steady-state sync after
// pairing is NOT union-based (see useFavoritesSync.ts) — a plain union can
// never represent an unmark, so ongoing sync replaces the whole payload
// instead.
//
// Rules, extending the server-first policy mergeFavoriteIds used to encode
// for a single starred/unstarred bit:
// - id set = union of both sides' mustSee and interested
// - tier: the server's tier wins if the server has one for that id, else the
//   local one — same "server wins" bias as the old merge, generalised to a
//   tri-state instead of a boolean
// - note: the server's note wins if it has a non-empty one for that id, else
//   the local one
// Order is server-first then new local-only ids, so a merge is deterministic
// and stable for tests/snapshots.
export function mergeMarks(server: MarksPayload, local: MarksPayload): MarksPayload {
  const serverTierOf = new Map<string, "must" | "interested">();
  for (const id of server.mustSee) serverTierOf.set(id, "must");
  for (const id of server.interested) serverTierOf.set(id, "interested");

  const localTierOf = new Map<string, "must" | "interested">();
  for (const id of local.mustSee) localTierOf.set(id, "must");
  for (const id of local.interested) localTierOf.set(id, "interested");

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of [...server.mustSee, ...server.interested, ...local.mustSee, ...local.interested]) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  }

  const mustSee: string[] = [];
  const interested: string[] = [];
  for (const id of orderedIds) {
    const tier = serverTierOf.get(id) ?? localTierOf.get(id);
    if (tier === "must") mustSee.push(id);
    else if (tier === "interested") interested.push(id);
  }

  const notes: Record<string, string> = {};
  const noteIds = new Set([...Object.keys(server.notes), ...Object.keys(local.notes)]);
  for (const id of noteIds) {
    const serverNote = server.notes[id];
    const localNote = local.notes[id];
    const note = serverNote && serverNote.length > 0 ? serverNote : localNote;
    if (note) notes[id] = note;
  }

  return { mustSee, interested, notes };
}

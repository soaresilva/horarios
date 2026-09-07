// Union of a device's local favorites with the server's, used exactly once
// per pairing (see redeemPairingCode in src/app/favorites/actions.ts) so
// neither side's pre-pairing list is silently discarded. Steady-state sync
// after pairing is NOT union-based (see useFavoritesSync.ts) — a plain union
// can never represent an unstar, so ongoing sync replaces the whole array
// instead. Order is server-first then new local-only ids, so a merge is
// deterministic and stable for tests/snapshots.
export function mergeFavoriteIds(serverIds: string[], localIds: string[]): string[] {
  const merged = [...serverIds];
  for (const id of localIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

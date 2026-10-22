export interface StageLike {
  id: string;
  name: string;
  address: string | null;
}

const mapsSearch = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const addressKey = (address: string) => address.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * A Google Maps search link for a stage, not a pin — there are no
 * geo-coordinates anywhere in the schema, only a free-text `Stage.address`,
 * so this is the honest thing to link to rather than faking a precise pin.
 *
 * No hardcoded city fallback when `address` is null: this is shared across
 * every festival now, and a fallback city that happened to be right for one
 * festival (Rotterdam, for Left of the Dial) would be silently wrong for
 * every other one.
 *
 * `sharedAddress` is for a room in a multi-room building: search the address
 * alone, because the room name sends Google somewhere else. "Pandora,
 * Vredenburgkade 11" finds the jewellery shop, not TivoliVredenburg, and the
 * building's other rooms each land on a different pin. Use `stageMapsUrls`,
 * which works this out from the festival's stage list.
 */
export function stageMapsUrl(stage: Omit<StageLike, "id">, { sharedAddress = false } = {}): string {
  if (!stage.address) return mapsSearch(stage.name);
  return mapsSearch(sharedAddress ? stage.address : `${stage.name}, ${stage.address}`);
}

/**
 * Maps link per stage id. Stages whose address another stage also has are
 * rooms of one building, so they all get the same address-only link; a
 * one-room venue keeps name + address, which lands on its business listing.
 * Pass every stage of the festival, not one day's, so a room's link doesn't
 * change with the day picked.
 */
export function stageMapsUrls(stages: StageLike[]): Map<string, string> {
  const rooms = new Map<string, number>();
  for (const s of stages) if (s.address) rooms.set(addressKey(s.address), (rooms.get(addressKey(s.address)) ?? 0) + 1);
  return new Map(
    stages.map((s) => [s.id, stageMapsUrl(s, { sharedAddress: !!s.address && rooms.get(addressKey(s.address))! > 1 })]),
  );
}

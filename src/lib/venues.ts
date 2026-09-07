export interface StageLike {
  name: string;
  address: string | null;
}

/**
 * A Google Maps search link for a stage, not a pin — there are no
 * geo-coordinates anywhere in the schema, only a free-text `Stage.address`,
 * so this is the honest thing to link to rather than faking a precise pin.
 *
 * No hardcoded city fallback when `address` is null: this is shared across
 * every festival now, and a fallback city that happened to be right for one
 * festival (Rotterdam, for Left of the Dial) would be silently wrong for
 * every other one.
 */
export function stageMapsUrl(stage: StageLike): string {
  const query = stage.address ? `${stage.name}, ${stage.address}` : stage.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

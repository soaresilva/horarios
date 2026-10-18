// Pure parsing of a leguesswho.com/about/venues/<slug> page. Each one carries
// the venue's street address and the pin its Google Map drops, which is the
// festival's own word on where the door is. Walking times are computed from
// those pins (zones.ts), so nothing here is geocoded or guessed.

export interface VenueFacts {
  /** Venue page slug ("tivolivredenburg", "hof-van-cartesius"). */
  slug: string;
  address: string;
  lat: number;
  lng: number;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");

export function parseVenuePage(slug: string, html: string): VenueFacts {
  // `new google.maps.LatLng(52.0926,5.1131)` for the marker. The page also
  // builds LatLngBounds from (-45,-360)..(45,360); those never start with a
  // Dutch latitude, so the first 5x.x pair is the marker.
  const pin = html.match(/LatLng\((5\d\.\d+),\s*(\d\.\d+)\)/);
  if (!pin) throw new Error(`Venue page ${slug}: no map pin.`);

  // "<h..>Address</h..> <p>Vlampijpstraat 94, 3534 AR</p>": take the first
  // text node after the Address label.
  const text = decode(html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, "|"))
    .split("|")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const at = text.indexOf("Address");
  const address = at >= 0 ? text[at + 1] : undefined;
  if (!address || !/\d/.test(address)) throw new Error(`Venue page ${slug}: no street address after "Address".`);

  return { slug, address, lat: Number(pin[1]), lng: Number(pin[2]) };
}

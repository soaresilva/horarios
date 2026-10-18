// Walking minutes between LGW zones, computed from the festival's own venue
// pins rather than typed in by hand (LOTD's were hand-estimated). Pure, so
// the numbers are reproducible from the committed snapshot and tested.
//
// Model: straight-line (haversine) distance between zone centroids, times a
// 1.3 detour factor for Utrecht's street grid and canals, at 80 m/min (a
// steady 4.8 km/h). Rounded up, so it never promises less than the walk.
// It's an estimate of the walk between zone centres; two rooms at
// opposite edges of a zone can be a couple of minutes further apart.
import { HUB_ZONE, ROOMS, ZONES } from "./venues";
import type { VenueFacts } from "./venue-page";

export const DETOUR_FACTOR = 1.3;
export const METRES_PER_MINUTE = 80;

export interface Point {
  lat: number;
  lng: number;
}

export function haversineMetres(a: Point, b: Point): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function walkMinutes(a: Point, b: Point): number {
  return Math.ceil((haversineMetres(a, b) * DETOUR_FACTOR) / METRES_PER_MINUTE);
}

/** Mean of a zone's distinct venue pins (rooms in one building count once). */
export function zoneCentroids(venues: Record<string, VenueFacts | null>): Map<string, Point> {
  const centroids = new Map<string, Point>();
  for (const zone of ZONES) {
    const venueNames = [...new Set(ROOMS.filter((r) => r.zone === zone.slug).map((r) => r.venue))];
    const pins = venueNames.map((name) => {
      const facts = venues[name];
      if (!facts) throw new Error(`No venue page facts for "${name}" (zone ${zone.slug}); re-run --fetch.`);
      return facts;
    });
    if (pins.length === 0) throw new Error(`Zone ${zone.slug} has no rooms.`);
    centroids.set(zone.slug, {
      lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length,
      lng: pins.reduce((s, p) => s + p.lng, 0) / pins.length,
    });
  }
  return centroids;
}

export interface ZoneWalkRow {
  from: string;
  to: string;
  minutes: number;
}

/** One row per unordered zone pair, in ZONES order (the shape ZoneWalk stores). */
export function zoneWalkRows(venues: Record<string, VenueFacts | null>): ZoneWalkRow[] {
  const c = zoneCentroids(venues);
  const rows: ZoneWalkRow[] = [];
  for (let i = 0; i < ZONES.length; i++) {
    for (let j = i + 1; j < ZONES.length; j++) {
      const from = ZONES[i].slug;
      const to = ZONES[j].slug;
      rows.push({ from, to, minutes: walkMinutes(c.get(from)!, c.get(to)!) });
    }
  }
  return rows;
}

/**
 * Minutes from the TivoliVredenburg pin itself (not the hub zone's
 * centroid) to each zone; null for the hub zone, whose header then shows no
 * distance rather than a meaningless "0 min".
 */
export function walkFromHub(venues: Record<string, VenueFacts | null>): Map<string, number | null> {
  const c = zoneCentroids(venues);
  const hub = venues["TivoliVredenburg"];
  if (!hub) throw new Error("No venue facts for TivoliVredenburg.");
  return new Map(ZONES.map((z) => [z.slug, z.slug === HUB_ZONE ? null : walkMinutes(hub, c.get(z.slug)!)]));
}

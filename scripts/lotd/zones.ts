// Walking minutes for Left of the Dial's zones, computed from the room
// points in rooms.ts with Le Guess Who?'s model (straight line x detour, at
// 80 m/min, rounded up). These replaced hand estimates that had Schouwburgplein
// to Witte de With at 6 minutes for a ~1 km walk.
//
// The detour factor is fitted to the festival's own chart of walking times
// from the ticket desk: at 1.15 the 25 charted rooms are 0.9 minutes off on
// average with no lean either way (zones.test.ts holds that), where LGW's
// 1.3 runs over a minute slow across the board.
import { walkMinutes, type Point } from "../lgw/zones";
import { ROOMS, TICKET_DESK, ZONES } from "./rooms";

export const LOTD_DETOUR_FACTOR = 1.15;

export const lotdWalkMinutes = (a: Point, b: Point) => walkMinutes(a, b, LOTD_DETOUR_FACTOR);

/** Mean of a zone's distinct points (rooms in one building count once). */
export function zoneCentroids(): Map<string, Point> {
  const centroids = new Map<string, Point>();
  for (const zone of ZONES) {
    const points = [
      ...new Map(ROOMS.filter((r) => r.zone === zone.slug).map((r) => [`${r.point.lat},${r.point.lng}`, r.point])).values(),
    ];
    if (points.length === 0) throw new Error(`Zone ${zone.slug} has no rooms.`);
    centroids.set(zone.slug, {
      lat: points.reduce((s, pt) => s + pt.lat, 0) / points.length,
      lng: points.reduce((s, pt) => s + pt.lng, 0) / points.length,
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
export function zoneWalkRows(): ZoneWalkRow[] {
  const c = zoneCentroids();
  const rows: ZoneWalkRow[] = [];
  for (let i = 0; i < ZONES.length; i++) {
    for (let j = i + 1; j < ZONES.length; j++) {
      const from = ZONES[i].slug;
      const to = ZONES[j].slug;
      rows.push({ from, to, minutes: lotdWalkMinutes(c.get(from)!, c.get(to)!) });
    }
  }
  return rows;
}

/**
 * Minutes from the ticket desk to each zone's centroid. Unlike LGW's hub,
 * the desk isn't a venue, so the Eendrachtsplein zone gets a number too.
 */
export function walkFromTicketDesk(): Map<string, number> {
  const c = zoneCentroids();
  return new Map(ZONES.map((z) => [z.slug, lotdWalkMinutes(TICKET_DESK, c.get(z.slug)!)]));
}

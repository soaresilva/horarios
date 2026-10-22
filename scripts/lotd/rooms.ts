// Every lotd26 room: its walking zone, street address and map point. The
// source of truth for the Zone / Stage / ZoneWalk rows; `npm run import:lotd
// -- --sql` turns it into migration SQL (migration-sql.ts), and zones.test.ts
// fails if the latest migration's block has drifted from it.
//
// ADDRESSES are the festival's own venue chart (leftofthedial.nl/venues/,
// "LOTD-LOCATIONS-versie-3-augustus-met-Barrio"), checked against the Dutch
// address register (BAG). Two places where the chart is wrong:
// - De Doelen Up: the chart says Karel Doormanstraat 23. De Doelen's own site
//   puts the Eduard Flipse Zaal entrance at 223; 23 is another building.
// - Salsability: the chart says Schiestraat 22, which isn't a registered
//   address. Delftseplein 36 is the building (BAG puts Schiestraat 42-50 in it).
// The four TOUO-only rooms (Plato, Tramhuis, Zondebok, Time Is The New Space)
// aren't on the chart; see 20261016120000_add_touo_side_programme.
//
// POINTS are BAG address centroids from the PDOK Locatieserver
// (api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=<address>&fq=type:adres),
// except Mono (Vijverhofstraat 15 isn't a BAG address; its neighbour 21 is)
// and Tramhuis (no house number; the square's own point).
import type { Point } from "../lgw/zones";

export interface LotdZone {
  slug: string;
  name: string;
}

/**
 * In `order`: a walk across the city from the Eendrachtsplein ticket desk.
 * Roughly outward, not strictly (Wijnhaven is nearer than Schieblock); it
 * is the grid's venue-group order, so it doesn't move with the minutes.
 */
export const ZONES: LotdZone[] = [
  { slug: "eendrachtsplein", name: "Eendrachtsplein" },
  { slug: "museumpark", name: "Museumpark" },
  { slug: "schouwburgplein", name: "Schouwburgplein" },
  { slug: "witte-de-with", name: "Witte de With" },
  { slug: "schieblock", name: "Schieblock" },
  { slug: "willemsplein", name: "Willemsplein" },
  { slug: "wijnhaven", name: "Wijnhaven" },
  { slug: "zoho", name: "ZOHO" },
];

/** The wristband desk on the Eendrachtsplein: what "min from ticket desk" measures from. */
export const TICKET_DESK: Point = { lat: 51.91678577, lng: 4.47249175 };

export interface LotdRoom {
  slug: string;
  name: string;
  zone: string;
  address: string;
  point: Point;
  /** Minutes from the ticket desk on the festival's own chart; absent for rooms not on it. */
  chartMinutes?: number;
}

const p = (lat: number, lng: number): Point => ({ lat, lng });

/** Zone by zone, so a room's index doubles as its `order`. */
export const ROOMS: LotdRoom[] = [
  // "Stalles (fka Centraal)" is Club Centraal, the club behind Café Stalles,
  // not the café's Nieuwe Binnenweg 11A door.
  { slug: "stalles", name: "Stalles", zone: "eendrachtsplein", address: "Westersingel 50A, 3014 GV Rotterdam", point: p(51.91729848, 4.47216719), chartMinutes: 2 },
  { slug: "rotown", name: "Rotown", zone: "eendrachtsplein", address: "Nieuwe Binnenweg 19, 3014 GB Rotterdam", point: p(51.91702088, 4.47171915), chartMinutes: 3 },
  { slug: "paradijskerk", name: "Paradijskerk", zone: "eendrachtsplein", address: "Nieuwe Binnenweg 25, 3014 GB Rotterdam", point: p(51.91697888, 4.47129573), chartMinutes: 4 },
  { slug: "uniek", name: "Uniek", zone: "eendrachtsplein", address: "Mauritsweg 34, 3012 JT Rotterdam", point: p(51.91900819, 4.47254304), chartMinutes: 3 },
  { slug: "v2", name: "V2_", zone: "eendrachtsplein", address: "Eendrachtsstraat 10, 3012 XL Rotterdam", point: p(51.91552176, 4.47632138), chartMinutes: 3 },
  { slug: "plato", name: "Plato", zone: "eendrachtsplein", address: "Nieuwe Binnenweg 13, Rotterdam", point: p(51.91696943, 4.47192823) },
  { slug: "tramhuis", name: "Tramhuis", zone: "eendrachtsplein", address: "Eendrachtsplein, Rotterdam", point: TICKET_DESK },

  // One building with two doors: Down is entered from the Westersingel side.
  { slug: "arminius-down", name: "Arminius Down", zone: "museumpark", address: "Westersingel 76, 3015 LB Rotterdam", point: p(51.91502965, 4.47400775), chartMinutes: 4 },
  { slug: "arminius-up", name: "Arminius Up", zone: "museumpark", address: "Museumpark 3, 3015 CB Rotterdam", point: p(51.91502965, 4.47400775), chartMinutes: 4 },

  { slug: "de-doelen-up", name: "De Doelen Up", zone: "schouwburgplein", address: "Karel Doormanstraat 223, 3012 GH Rotterdam", point: p(51.92175225, 4.47318716), chartMinutes: 8 },
  { slug: "de-doelen-wbh", name: "De Doelen WBH", zone: "schouwburgplein", address: "Kruisplein 40, 3012 CC Rotterdam", point: p(51.92175225, 4.47318716), chartMinutes: 7 },
  // Theater Rotterdam's main building on the Schouwburgplein, not TR8 on
  // William Boothlaan: the chart lists all three halls ("3 zalen") here.
  { slug: "tr-up", name: "TR Up", zone: "schouwburgplein", address: "Schouwburgplein 25, 3012 CL Rotterdam", point: p(51.92013761, 4.47403261), chartMinutes: 5 },
  { slug: "tr-down", name: "TR Down", zone: "schouwburgplein", address: "Schouwburgplein 25, 3012 CL Rotterdam", point: p(51.92013761, 4.47403261), chartMinutes: 5 },
  { slug: "tr-foyer", name: "TR Foyer", zone: "schouwburgplein", address: "Schouwburgplein 25, 3012 CL Rotterdam", point: p(51.92013761, 4.47403261), chartMinutes: 5 },

  { slug: "worm-1", name: "Worm 1", zone: "witte-de-with", address: "Boomgaardsstraat 71, 3012 XA Rotterdam", point: p(51.91593682, 4.47626133), chartMinutes: 4 },
  { slug: "worm-2", name: "Worm 2", zone: "witte-de-with", address: "Boomgaardsstraat 71, 3012 XA Rotterdam", point: p(51.91593682, 4.47626133), chartMinutes: 4 },
  { slug: "baanhof", name: "Baanhof", zone: "witte-de-with", address: "Baan 159, 3011 CA Rotterdam", point: p(51.91306731, 4.48038034), chartMinutes: 10 },
  { slug: "waalse-kerk", name: "Waalse Kerk", zone: "witte-de-with", address: "Pierre Baylestraat 1, 3011 CN Rotterdam", point: p(51.91383755, 4.47992585), chartMinutes: 8 },
  { slug: "zondebok", name: "Zondebok & 't Zwarte Schaap", zone: "witte-de-with", address: "Witte de Withstraat 96, Rotterdam", point: p(51.91504364, 4.47533526) },

  { slug: "annabel-down", name: "Annabel Down", zone: "schieblock", address: "Schiestraat 20, 3013 AH Rotterdam", point: p(51.9253651, 4.47609478), chartMinutes: 15 },
  { slug: "annabel-up", name: "Annabel Up", zone: "schieblock", address: "Schiestraat 20, 3013 AH Rotterdam", point: p(51.9253651, 4.47609478), chartMinutes: 15 },
  { slug: "sahara", name: "Sahara", zone: "schieblock", address: "Schiestraat 18, 3013 AH Rotterdam", point: p(51.92538835, 4.4762211), chartMinutes: 14 },
  { slug: "barrio", name: "Barrio", zone: "schieblock", address: "Schiestraat 18, 3013 AH Rotterdam", point: p(51.92538835, 4.4762211), chartMinutes: 15 },
  { slug: "salsability", name: "Salsability", zone: "schieblock", address: "Delftseplein 36, 3013 AA Rotterdam", point: p(51.92510116, 4.47430611), chartMinutes: 15 },
  { slug: "time-new-space", name: "Time Is The New Space", zone: "schieblock", address: "Schiekade 185, Rotterdam", point: p(51.92574191, 4.47651966) },

  { slug: "remastered", name: "Remastered", zone: "willemsplein", address: "Willemsplein 79, 3016 DR Rotterdam", point: p(51.91057701, 4.4831145), chartMinutes: 15 },

  { slug: "v11", name: "V11", zone: "wijnhaven", address: "Wijnhaven 101B, 3011 WN Rotterdam", point: p(51.91736716, 4.48477139), chartMinutes: 11 },

  { slug: "mono", name: "Mono", zone: "zoho", address: "Vijverhofstraat 15, 3032 SB Rotterdam", point: p(51.92872968, 4.47821997), chartMinutes: 22 },
  { slug: "reijngoud", name: "Reijngoud", zone: "zoho", address: "Vijverhofstraat 10, 3032 SN Rotterdam", point: p(51.92847486, 4.47807092), chartMinutes: 23 },
  { slug: "bird", name: "Bird", zone: "zoho", address: "Raampoortstraat 24, 3032 AH Rotterdam", point: p(51.92672585, 4.47885067), chartMinutes: 20 },
];

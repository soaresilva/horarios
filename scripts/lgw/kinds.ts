// What kind of item each LGW timetable entry is. leguesswho.com has no
// category field, so this is rules plus a hand list, read off each item's
// lineup page on 2026-10-18. The "non-concerts" switch on the grid hides
// everything that isn't CONCERT.
//
// Keyed by the show's name, not its lineup slug: slugs aren't unique per
// item ("Not Fit For TV" and "Let the New Take Root" share one page, so do
// "Community dinner" and "When Cultures Meet").
import type { RawShow } from "./parse";

export type PerformanceKind = "CONCERT" | "FILM" | "TALK" | "WORKSHOP" | "EXHIBITION" | "OTHER";

export const KIND_BY_NAME: Record<string, Exclude<PerformanceKind, "CONCERT">> = {
  // Karimah Ashadu's film installation at Centraal Museum's Annex, open
  // 11:00-17:00 every day.
  "MUSCLE by Karimah Ashadu": "EXHIBITION",
  // Creative Coding Utrecht's installations in and around the Boomtoren.
  "Some Call it Love, Others Biodiversity": "EXHIBITION",
  // Three documentaries screened through the day (Sound & Culture Summit).
  "TIMES Documentaries": "FILM",
  "The Talk (Heith, Günseli Yalcinkaya, Andrea Belosi)": "TALK",
  // Upcycling with Henk Loorbach and Stickit.
  "Litterbugs": "WORKSHOP",
  // Sewing circle and scavenger walk at De Voorkamer.
  "When Cultures Meet": "WORKSHOP",
  // Shared meals.
  "A Tavola!": "OTHER",
  "Community dinner": "OTHER",
  // Darkroom portraits.
  "Analogue Photobooth | Het Kleinste Kamertje": "OTHER",
  // Participatory theatre pieces.
  "The Wage Gap Will See You Now": "OTHER",
  "Massage Puppetry™ - theater that heals you": "OTHER",
  // Studio de Kiemkamer's afternoon of workshops, art and performances
  // (its own slots, "Not Fit For TV", are music and stay CONCERT).
  "Let the New Take Root": "OTHER",
  // A ball: voguing categories and community, not a concert.
  "Let's Kii: Celebrating ballroom culture in Utrecht": "OTHER",
  // AYO's rest space.
  "The Temple": "OTHER",
  // Installations, workshops and a catwalk, with DJs on the side.
  "Club Villa Genitalia": "OTHER",
  // Fai Aldhukair's series of workshops, lectures and performances.
  "EPHEMERA: PRACTICES OF PRESERVATION": "OTHER",
  // Jô Páscoa's afternoon programme at Moira.
  "Tender Monsters and Filthy Queers": "OTHER",
};

/**
 * Concerts that run three hours or more, checked by hand. Anything else
 * that long and still CONCERT fails --check: a new exhibition or day-long
 * programme then can't slip onto the concert grid unnoticed.
 */
export const LONG_CONCERTS = new Set([
  // KMRU's eight-hour listening piece in Cloud Nine.
  "WAI8",
  "Eris Drew & Octo Octa",
  // death by dagger's co-curated live programme at Keen Coffee.
  "death by dagger",
  // Perry Gits' day of ambient and experimental live sets at BASIS.
  "...",
  // Sunday's closing club night in Pandora, 23:00-02:30. No lineup page.
  "Afterparty",
]);

export const LONG_ITEM_HOURS = 3;

export function kindOf(show: Pick<RawShow, "name" | "project">): PerformanceKind {
  const listed = KIND_BY_NAME[show.name];
  if (listed) return listed;
  if (show.project === "Film") return "FILM";
  if (/^workshop:/i.test(show.name)) return "WORKSHOP";
  if (show.project === "Sound & Culture Summit") return "TALK";
  return "CONCERT";
}

/**
 * Hand-list names the timetable no longer has. A stale entry means an item
 * was renamed on the site, and the renamed one is now classified by the
 * fallback rules instead. Only meaningful against a whole timetable, so
 * --check runs it, not planLgw.
 */
export function staleKindNames(shows: Pick<RawShow, "name">[]): string[] {
  const names = new Set(shows.map((s) => s.name));
  return [...Object.keys(KIND_BY_NAME), ...LONG_CONCERTS]
    .filter((name) => !names.has(name))
    .map((name) => `"${name}" is in kinds.ts but no longer in the timetable (renamed?).`);
}

/** Long items the rules would call concerts without anyone having said so. */
export function kindProblems(shows: Pick<RawShow, "name" | "project" | "start" | "end">[]): string[] {
  const problems: string[] = [];
  for (const s of shows) {
    if (s.end - s.start >= LONG_ITEM_HOURS && kindOf(s) === "CONCERT" && !LONG_CONCERTS.has(s.name)) {
      problems.push(
        `"${s.name}" runs ${s.end - s.start}h and is classified CONCERT. Add it to KIND_BY_NAME or LONG_CONCERTS in scripts/lgw/kinds.ts.`,
      );
    }
  }
  return problems;
}

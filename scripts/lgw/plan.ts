// Pure planning for the LGW importer: snapshot -> performance + artist rows,
// plus every check that should stop a bad snapshot before it reaches a
// database. No Prisma, no I/O, so all of it is gate-tested.
import { zoneOffset } from "../../src/lib/time";
import { findOverlaps } from "../touo/plan";
import { kindOf, kindProblems, type PerformanceKind } from "./kinds";
import type { Programme, RawShow } from "./parse";
import type { LgwSnapshot } from "./snapshot";
import { roomFor } from "./venues";

export const FESTIVAL_ID = "lgw26";
export const TIMEZONE = "Europe/Amsterdam";
export const PERFORMANCE_ID_PREFIX = "lgw26-p-";
export const ARTIST_ID_PREFIX = "lgw26-a-";
export const U_SERIES = "U?";
const SITE = "https://leguesswho.com";

/**
 * Blocks that summarise other entries rather than being an item of their
 * own. Dropping them keeps the grid from showing the same afternoon twice.
 */
export const UMBRELLAS: { programme: Programme; venue: string; name: string; why: string }[] = [
  // The main timetable's pointer to the whole U? programme, as one 13:00-20:00
  // block. The U? switch shows the real thing.
  { programme: "LGW", venue: "Cartesius Area", name: "U?", why: "stands in for the whole U? programme" },
  // U?'s listing of the totally wired night at dB's, 15:00-23:00. The main
  // timetable already lists every one of its sets in dB's two rooms.
  { programme: "U?", venue: "dB's", name: "totally wired", why: "repeats the dB's sets in the main timetable" },
];

const isUmbrella = (s: RawShow) =>
  UMBRELLAS.some((u) => u.programme === s.programme && u.venue === s.venue && u.name === s.name);

export interface PlannedPerformance {
  id: string;
  showId: number;
  artistName: string;
  artistId: string;
  stageSlug: string;
  /** Site day tab, so CARISTA at 06:30 Sunday still sits on Saturday's grid next to the rest of 24 HOUR DUB. */
  date: string;
  startTime: Date;
  endTime: Date;
  /** "U?" for the U? programme, null for the main one. */
  series: string | null;
  /** The curated project ("Curated by aja monet", "24 HOUR DUB"), shown in the mark sheet. */
  host: string | null;
  kind: PerformanceKind;
}

export interface PlannedArtist {
  id: string;
  slug: string;
  name: string;
  sourceUrl: string | null;
}

export interface LgwPlan {
  performances: PlannedPerformance[];
  artists: PlannedArtist[];
  /** Everything wrong with the snapshot. Non-empty means don't apply. */
  problems: string[];
  dropped: { umbrellas: number; duplicates: number };
}

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/ø/gi, "o")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    // "..." (Perry Gits' programme) has no letters at all.
    "untitled"
  );
}

/**
 * The instant `hours` after `day`'s local midnight in Amsterdam. The site
 * keys 06:30 on Saturday's tab as 30.5, so this lands on Sunday 06:30 with
 * no guessing. It deliberately never goes near fromFestivalDayTime's 06:00
 * roll heuristic, which would put 24 HOUR DUB's 05:30-08:30 sets on the
 * wrong day. Uses that day's UTC offset; there is no DST change during the
 * festival (the clocks went back on 25 October).
 */
export function instantAt(day: string, hours: number): Date {
  const midnight = Date.parse(`${day}T00:00:00${zoneOffset(TIMEZONE, day)}`);
  return new Date(midnight + Math.round(hours * 60) * 60_000);
}

/** The project's full name from the snapshot's list, or the show's own short label. */
function hostOf(show: RawShow, projectNames: Map<number, string>): string | null {
  // "Film" only repeats what the FILM chip already says.
  if (show.project === "Film") return null;
  return (show.projectId !== null ? projectNames.get(show.projectId) : undefined) ?? show.project;
}

export function planLgw(snapshot: LgwSnapshot): LgwPlan {
  const problems: string[] = [];
  const projectNames = new Map(snapshot.projects.map((p) => [p.id, p.name]));

  for (const u of UMBRELLAS) {
    if (!snapshot.shows.some((s) => s.programme === u.programme && s.venue === u.venue && s.name === u.name)) {
      problems.push(`Umbrella "${u.name}" (${u.programme}, ${u.venue}) is gone from the timetable; drop it from UMBRELLAS.`);
    }
  }
  for (const [programme, days] of Object.entries(snapshot.days)) {
    for (const day of days) {
      if (!snapshot.shows.some((s) => s.programme === programme && s.day === day)) {
        problems.push(`${programme} ${day} has a day tab but no shows; did the fetch break?`);
      }
    }
  }

  // An item listed in both timetables (three on Sunday) is one show, and
  // stays in the main programme: it's in the main timetable, so it should
  // be on the grid with the U? switch off. The two listings carry different
  // show ids, so "the same item" means same day, room, times and name.
  const sameItem = (s: RawShow) => [s.day, s.venue, s.room ?? "", s.start, s.end, s.name].join("\u0000");
  const kept = new Map<string, RawShow>();
  let umbrellas = 0;
  let duplicates = 0;
  const ordered = [...snapshot.shows].sort((a, b) => (a.programme === b.programme ? 0 : a.programme === "LGW" ? -1 : 1));
  for (const show of ordered) {
    if (isUmbrella(show)) {
      umbrellas++;
      continue;
    }
    const key = sameItem(show);
    const earlier = kept.get(key);
    if (earlier) {
      if (earlier.programme === show.programme) {
        problems.push(`"${show.name}" is listed twice in the ${show.programme} timetable (${show.day} ${show.time}).`);
      }
      duplicates++;
      continue;
    }
    kept.set(key, show);
  }
  const shows = [...kept.values()];

  problems.push(...kindProblems(shows));

  // Several shows can share one lineup page, and one act can appear under
  // more than one: the act is its name, the page is just where it links.
  const artistsBySlug = new Map<string, PlannedArtist>();
  const performances: PlannedPerformance[] = [];
  for (const show of shows) {
    let room;
    try {
      room = roomFor(show.venue, show.room);
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err));
      continue;
    }
    if (!snapshot.venues[show.venue]) {
      problems.push(`"${show.name}" is in ${show.venue}, which has no venue page facts (address, pin).`);
    }

    const artistSlug = slugify(show.name);
    const artistId = `${ARTIST_ID_PREFIX}${artistSlug}`;
    const sourceUrl = show.slug ? `${SITE}/lineup/${show.slug}` : null;
    const artist = artistsBySlug.get(artistSlug);
    if (!artist) {
      artistsBySlug.set(artistSlug, { id: artistId, slug: artistSlug, name: show.name, sourceUrl });
    } else if (artist.sourceUrl === null && sourceUrl) {
      artist.sourceUrl = sourceUrl;
    }

    performances.push({
      // The site's own show id: stable across renames and time changes, so
      // a re-import updates the row (and keeps every visitor's marks on it)
      // instead of orphaning it.
      id: `${PERFORMANCE_ID_PREFIX}${show.showId}`,
      showId: show.showId,
      artistName: show.name,
      artistId,
      stageSlug: room.slug,
      date: show.day,
      startTime: instantAt(show.day, show.start),
      endTime: instantAt(show.day, show.end),
      series: show.programme === "U?" ? U_SERIES : null,
      host: hostOf(show, projectNames),
      kind: kindOf(show),
    });
  }

  problems.push(
    ...findOverlaps(
      performances.map((p) => ({
        id: p.id,
        label: `${p.artistName} (${p.date})`,
        stageKey: p.stageSlug,
        startTime: p.startTime,
        endTime: p.endTime,
      })),
    ),
  );

  performances.sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.showId - b.showId);
  const artists = [...artistsBySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  return { performances, artists, problems, dropped: { umbrellas, duplicates } };
}

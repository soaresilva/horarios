// Pure planning for the London Calling importer: snapshot rows -> artist and
// performance rows, plus the checks that make a bad snapshot fail before it
// reaches a database. No Prisma, no I/O, so all of it is gate-tested.
import { fromFestivalDayTime, type FestivalTime } from "../../src/lib/time";
import { findOverlaps, nameKey } from "../touo/plan";

export const LC_FESTIVAL_ID = "lc26oct";
export const LC_ID_PREFIX = "lc26oct-p-";
export const LC_ARTIST_PREFIX = "lc26oct-a-";
export const LC_SITE = "https://www.londoncalling.nl";
const FT: FestivalTime = { timezone: "Europe/Amsterdam", locale: "en-GB" };

export type LcDay = "FRIDAY" | "SATURDAY";

export const DAY_DATES: Record<LcDay, string> = {
  FRIDAY: "2026-10-30",
  SATURDAY: "2026-10-31",
};

/**
 * Rooms per day, in poster (and grid column) order. Must agree with the
 * Stage rows in prisma/migrations/…_add_lc26oct_festival, which own the
 * names and `order`; this only says which slug may appear on which day.
 */
export const STAGES_BY_DAY: Record<LcDay, readonly string[]> = {
  FRIDAY: ["small-hall", "main-hall", "de-kring"],
  SATURDAY: ["small-hall", "main-hall", "barlaeus"],
};

/**
 * Boxes per room per day, counted by eye on the posters, independently of
 * the snapshot. If a poster revision adds or drops a set, this disagrees
 * and the import stops. Update it from the poster, not from the snapshot,
 * or it checks nothing. (scripts/lc/measure-poster.py counts the boxes by
 * pixel too, as a second opinion.)
 */
export const EXPECTED_SETS_PER_ROOM: Record<string, number> = {
  "FRIDAY small-hall": 7,
  "FRIDAY main-hall": 7, // 6 bands + We Love 00's
  "FRIDAY de-kring": 3,
  "SATURDAY small-hall": 10,
  "SATURDAY main-hall": 10, // 9 bands + Indiesleaze
  "SATURDAY barlaeus": 4,
};

export interface LcSet {
  day: LcDay;
  stage: string;
  /** Display name: the artist page's own title for bands (keeps "keiyaA", "Tommy WÁ"). */
  name: string;
  start: string;
  end: string;
  /** "club" = a DJ/club night with no printed times and no artist page. */
  kind: "band" | "club";
  /** The londoncalling.nl artist slug. Explicit because names don't map
   * cleanly: Sandhouse lives at /artists/swapmeet-2/, and older editions
   * reuse names (/artists/cardinals/ is not this year's Cardinals). */
  artistSlug?: string;
  /** Times came from scripts/lc/measure-poster.py, not a printed label. */
  measured?: boolean;
}

export interface LcArtist {
  slug: string;
  name: string;
  sourceUrl: string;
  spotifyUrl: string | null;
}

export interface LcSnapshot {
  source: string;
  posters: Record<LcDay, string>;
  transcribedAt: string;
  notes: string;
  sets: LcSet[];
  /** Filled by `import:lc -- --fetch-artists`; empty until then. */
  artists: LcArtist[];
}

export interface PlannedLc {
  id: string;
  artistName: string;
  artistId: string | null;
  stageSlug: string;
  date: string;
  startTime: Date;
  endTime: Date;
}

const HHMM = /^\d\d:\d\d$/;

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Row id: one act never plays one room twice on one day, so this is unique and stable across re-imports. */
export function performanceId(set: LcSet): string {
  // Club nights key on their name before the description in brackets, so
  // rewording "(DJ sets: …)" doesn't orphan the row.
  const key = set.artistSlug ?? slugify(set.name.replace(/\s*\(.*$/, ""));
  return `${LC_ID_PREFIX}${set.day.toLowerCase()}-${key}`;
}

export function planLc(snapshot: LcSnapshot): PlannedLc[] {
  const artistSlugs = new Set(snapshot.artists.map((a) => a.slug));
  return snapshot.sets.map((set) => {
    const date = DAY_DATES[set.day];
    return {
      id: performanceId(set),
      artistName: set.name,
      artistId: set.artistSlug && artistSlugs.has(set.artistSlug) ? `${LC_ARTIST_PREFIX}${set.artistSlug}` : null,
      stageSlug: set.stage,
      date,
      startTime: fromFestivalDayTime(date, set.start, FT),
      endTime: fromFestivalDayTime(date, set.end, FT),
    };
  });
}

/** Everything wrong with a snapshot, as human-readable lines. Empty means safe to apply. */
export function validateLcSnapshot(snapshot: LcSnapshot): string[] {
  const errors: string[] = [];
  const { sets } = snapshot;

  const perRoom = new Map<string, number>();
  for (const s of sets) {
    const key = `${s.day} ${s.stage}`;
    perRoom.set(key, (perRoom.get(key) ?? 0) + 1);
  }
  for (const key of new Set([...perRoom.keys(), ...Object.keys(EXPECTED_SETS_PER_ROOM)])) {
    const got = perRoom.get(key) ?? 0;
    const want = EXPECTED_SETS_PER_ROOM[key] ?? 0;
    if (got !== want) errors.push(`${key}: poster shows ${want} sets, snapshot has ${got}.`);
  }

  for (const s of sets) {
    const label = `${s.name} (${s.day} ${s.stage})`;
    if (!(s.day in DAY_DATES)) {
      errors.push(`${label}: unknown day.`);
      continue;
    }
    if (!STAGES_BY_DAY[s.day].includes(s.stage)) errors.push(`${label}: no such room on ${s.day}.`);
    if (!HHMM.test(s.start) || !HHMM.test(s.end)) {
      errors.push(`${label}: malformed time ${s.start}-${s.end}.`);
      continue;
    }
    if (Number(s.start.slice(3)) % 5 !== 0 || Number(s.end.slice(3)) % 5 !== 0) {
      errors.push(`${label}: ${s.start}-${s.end} is off the poster's 5-minute grid.`);
    }
    const date = DAY_DATES[s.day];
    if (fromFestivalDayTime(date, s.end, FT) <= fromFestivalDayTime(date, s.start, FT)) {
      errors.push(`${label}: ends (${s.end}) before it starts (${s.start}).`);
    }
    if (s.kind === "band" && !s.artistSlug) errors.push(`${label}: band set without an artistSlug.`);
    if (s.kind === "club" && s.artistSlug) errors.push(`${label}: club night with an artistSlug.`);
  }

  const ids = new Map<string, string>();
  for (const s of sets) {
    const id = performanceId(s);
    if (ids.has(id)) errors.push(`Duplicate id ${id}: ${ids.get(id)} and ${s.name}.`);
    ids.set(id, s.name);
  }

  errors.push(
    ...findOverlaps(
      planLc({ ...snapshot, artists: [] }).map((p) => ({
        id: p.id,
        label: p.artistName,
        stageKey: `${p.date} ${p.stageSlug}`,
        startTime: p.startTime,
        endTime: p.endTime,
      })),
    ),
  );

  // Only once --fetch-artists has run: every band resolves to a page whose
  // title is the same act. Catches a wrong slug (an older edition's page,
  // or swapmeet-2 typed for Swapmeet) before it links the wrong band.
  if (snapshot.artists.length > 0) {
    const bySlug = new Map(snapshot.artists.map((a) => [a.slug, a]));
    for (const s of sets) {
      if (!s.artistSlug) continue;
      const artist = bySlug.get(s.artistSlug);
      if (!artist) errors.push(`${s.name}: no fetched artist for slug "${s.artistSlug}".`);
      else if (nameKey(artist.name) !== nameKey(s.name)) {
        errors.push(`${s.name}: slug "${s.artistSlug}" is the page for "${artist.name}".`);
      }
    }
  }

  return errors;
}

/** The act's own Spotify artist, from the page's embedded player. */
export function extractSpotifyArtist(html: string): string | null {
  // Every page also links the festival's own playlist (site-wide footer),
  // which is why only embed/artist counts.
  const ids = new Set([...html.matchAll(/open\.spotify\.com\/embed\/artist\/([A-Za-z0-9]{22})/g)].map((m) => m[1]));
  if (ids.size > 1) throw new Error(`Page embeds ${ids.size} different Spotify artists: ${[...ids].join(", ")}`);
  const [id] = ids;
  return id ? `https://open.spotify.com/artist/${id}` : null;
}

/**
 * Whether a Spotify artist (as named by Spotify's oEmbed) is the act itself.
 * The festival's pages are hand-built and copy-paste slips happen: in
 * October 2026 Really Good Time's page embeds Robber Robber. Same rule as
 * src/lib/artist-links.ts: no link beats a wrong one.
 */
export function spotifyMatches(spotifyTitle: string, actName: string): boolean {
  return nameKey(spotifyTitle) === nameKey(actName);
}

/** WordPress titles arrive HTML-escaped ("We Love 00&#8217;s"). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

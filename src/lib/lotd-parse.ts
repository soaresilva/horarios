// Parsers for Left of the Dial act pages. Pure string in, structured data
// out — no network, no filesystem — so they're covered by fast unit tests
// against committed fixtures.
//
// Regex against HTML rather than a DOM library: every target is a single
// distinctive class on a stable WordPress theme, and the shapes are pinned by
// fixtures. If the theme changes, reach for a parser library rather than
// escalating these patterns.

export interface ParsedShow {
  /** Day name as published, uppercase: "FRIDAY". */
  day: string;
  /** Venue string as published, uppercase: "WORM 2", "STALLES (FKA CENTRAAL)". */
  venue: string;
  /** "HH:MM", normalised from either "20:20" or "20.20". */
  time: string;
}

export interface ParsedAct {
  slug: string;
  name: string;
  country: string | null;
  genres: string | null;
  spotifyUrl: string | null;
  instagramUrl: string | null;
  sourceUrl: string;
  shows: ParsedShow[];
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&ndash;": "–",
  "&mdash;": "—",
};

export function decodeEntities(input: string): string {
  return input
    .replace(/&[a-z]+;|&#0?39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

/**
 * Which edition an act page belongs to, read from the WordPress category
 * classes on its <article>. A page for a past edition still lists its old
 * day/venue/time headings with no year attached, so parsing those without
 * checking this would silently import last year's schedule.
 */
export function editionYears(html: string): number[] {
  return [...html.matchAll(/category-past-(\d{4})/g)].map((m) => Number(m[1]));
}

export function isEditionYear(html: string, year: number): boolean {
  return editionYears(html).includes(year);
}

/** "Gordi (AU)" -> name "Gordi", country "AU". "(FR/UK)" is kept verbatim. */
export function parseNameAndCountry(html: string): { name: string; country: string | null } | null {
  const match = html.match(/<h1 class="entry-title-single">([\s\S]*?)<\/h1>/);
  if (!match) return null;
  const full = decodeEntities(match[1].replace(/<[^>]*>/g, "").trim());
  const withCountry = full.match(/^(.*?)\s*\(([A-Za-z/ .]{2,12})\)\s*$/);
  if (withCountry) {
    return { name: withCountry[1].trim(), country: withCountry[2].trim().toUpperCase() };
  }
  return { name: full, country: null };
}

/** The genre line, e.g. "alt-country / folk / rock". Rendered twice (a
 *  desktop and a mobile copy), so only the first is taken. */
export function parseGenres(html: string): string | null {
  const match = html.match(/<h3 class="GenreLink">([\s\S]*?)<\/h3>/);
  if (!match) return null;
  const value = decodeEntities(match[1].replace(/<[^>]*>/g, "").trim());
  return value || null;
}

// Canonical forms, matching the shapes src/lib/artist-links.test.ts already
// enforces for the hand-written Paredes de Coura table — one URL contract for
// both festivals. Anything that doesn't match is dropped rather than passed
// through: a half-recognised link is worse than no icon.
//
// Spotify appears in three shapes on these pages: a plain artist link, one
// carrying a ?si= share token, and — most commonly — the *embed* player URL
// (/embed/artist/...), which is what the page actually renders.
const SPOTIFY_RE = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?artist\/([A-Za-z0-9]+)/i;
const INSTAGRAM_RE = /^https?:\/\/(?:www\.)?instagram\.com\/([^/?#]+)/i;

export function normalizeSpotify(url: string): string | null {
  const match = url.match(SPOTIFY_RE);
  return match ? `https://open.spotify.com/artist/${match[1]}` : null;
}

export function normalizeInstagram(url: string): string | null {
  const match = url.match(INSTAGRAM_RE);
  if (!match) return null;
  const handle = match[1];
  // Not a profile: these paths are posts, reels and the explore surface.
  if (["p", "reel", "reels", "explore", "tv", "stories"].includes(handle.toLowerCase())) return null;
  return `https://www.instagram.com/${handle}/`;
}

/**
 * Social links from the header icon row.
 *
 * Classified by hostname, never by the link's own `title` attribute: at least
 * one act has a link titled "Facebook" pointing at YouTube, and trusting the
 * label would file a video under the wrong service.
 */
export function parseSocialLinks(html: string): { spotifyUrl: string | null; instagramUrl: string | null } {
  const section = html.match(/socialHeaderIcons"[\s\S]*?<\/div>/);
  let spotifyUrl: string | null = null;
  let instagramUrl: string | null = null;
  if (!section) return { spotifyUrl, instagramUrl };

  for (const match of section[0].matchAll(/href="([^"]+)"/g)) {
    const href = decodeEntities(match[1].trim());
    let hostname: string;
    try {
      hostname = new URL(href).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (!spotifyUrl && hostname.endsWith("spotify.com")) spotifyUrl = normalizeSpotify(href);
    if (!instagramUrl && hostname.endsWith("instagram.com")) instagramUrl = normalizeInstagram(href);
  }
  return { spotifyUrl, instagramUrl };
}

/** "20.20" and "20:20" both appear in the published data. */
export function parseClock(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * The performance headings, e.g. `FRIDAY | WORM 2 | 20:20`.
 *
 * The "Go to the previous act" navigation block carries the same
 * `festivalShows` class but wraps a container div rather than an <h3>, so
 * requiring the heading immediately after the div excludes it.
 */
export function parseShows(html: string): ParsedShow[] {
  const shows: ParsedShow[] = [];
  for (const match of html.matchAll(/festivalShows"[^>]*>\s*<h3>([\s\S]*?)<\/h3>/g)) {
    const parts = decodeEntities(match[1].replace(/<[^>]*>/g, ""))
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length !== 3) continue;
    const time = parseClock(parts[2]);
    if (!time) continue;
    shows.push({ day: parts[0].toUpperCase(), venue: parts[1].toUpperCase(), time });
  }
  return shows;
}

export function parseActPage(html: string, slug: string, sourceUrl: string): ParsedAct | null {
  const named = parseNameAndCountry(html);
  if (!named) return null;
  const { spotifyUrl, instagramUrl } = parseSocialLinks(html);
  return {
    slug,
    name: named.name,
    country: named.country,
    genres: parseGenres(html),
    spotifyUrl,
    instagramUrl,
    sourceUrl,
    shows: parseShows(html),
  };
}

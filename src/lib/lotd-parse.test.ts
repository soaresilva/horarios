import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  editionYears,
  isEditionYear,
  normalizeInstagram,
  normalizeSpotify,
  parseActPage,
  parseClock,
  parseGenres,
  parseNameAndCountry,
  parseShows,
  parseSocialLinks,
} from "./lotd-parse";

const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "__fixtures__", "lotd", `${name}.html`), "utf8");

const gordi = fixture("gordi-au");
const brownHorse = fixture("brown-horse-uk-past2025");

describe("editionYears", () => {
  it("reads the edition from the article's category classes", () => {
    expect(editionYears(gordi)).toEqual([2026]);
    expect(isEditionYear(gordi, 2026)).toBe(true);
  });

  // The trap this exists for: a past-edition page still lists its old
  // day/venue/time headings with no year attached, so it would import
  // cleanly and wrongly.
  it("identifies a past-edition page, whose shows must not be imported as this year's", () => {
    expect(editionYears(brownHorse)).toEqual([2025]);
    expect(isEditionYear(brownHorse, 2026)).toBe(false);
    // ...even though it parses perfectly well and looks like real data.
    expect(parseShows(brownHorse).length).toBeGreaterThan(0);
  });
});

describe("parseNameAndCountry", () => {
  it("splits a trailing country code off the title", () => {
    expect(parseNameAndCountry(gordi)).toEqual({ name: "Gordi", country: "AU" });
  });

  it("keeps a multi-country code verbatim", () => {
    expect(parseNameAndCountry('<h1 class="entry-title-single">Baby Smith (AU/DE)</h1>')).toEqual({
      name: "Baby Smith",
      country: "AU/DE",
    });
  });

  it("returns a null country when the title has no parenthesised code", () => {
    expect(parseNameAndCountry('<h1 class="entry-title-single">Body Horror</h1>')).toEqual({
      name: "Body Horror",
      country: null,
    });
  });

  it("decodes entities in the name", () => {
    expect(parseNameAndCountry(`<h1 class="entry-title-single">Cro&iacute;the &amp; Co (IE)</h1>`)?.name).toBe(
      "Cro&iacute;the & Co",
    );
  });
});

describe("parseGenres", () => {
  it("takes the genre line", () => {
    expect(parseGenres(gordi)).toBe("indie pop / pop");
  });

  // The theme renders the genre twice, once for desktop and once for mobile.
  it("takes only the first of the duplicated genre elements", () => {
    const html = '<h3 class="GenreLink">a / b</h3><h3 class="GenreLink">a / b</h3>';
    expect(parseGenres(html)).toBe("a / b");
  });
});

describe("normalizeSpotify", () => {
  // The page renders the *embed player* URL, not a plain artist link — the
  // shape a naive artist-only pattern would silently drop.
  it("canonicalises an embed URL with a share token", () => {
    expect(
      normalizeSpotify("https://open.spotify.com/embed/artist/6UBMFaCTZnL1Hr1nTOEblM?si=dr-6vzHO"),
    ).toBe("https://open.spotify.com/artist/6UBMFaCTZnL1Hr1nTOEblM");
  });

  it("strips a locale path segment", () => {
    expect(normalizeSpotify("https://open.spotify.com/intl-fr/artist/6TnRsbEEAkxaOYJLcEWd5m")).toBe(
      "https://open.spotify.com/artist/6TnRsbEEAkxaOYJLcEWd5m",
    );
  });

  it("drops anything that isn't an artist link rather than passing it through", () => {
    expect(normalizeSpotify("https://open.spotify.com/album/123")).toBeNull();
    expect(normalizeSpotify("https://example.com/artist/123")).toBeNull();
  });

  // Same contract the hand-written Paredes de Coura table is held to.
  it("produces a URL matching the shape artist-links.test.ts enforces", () => {
    const url = normalizeSpotify("https://open.spotify.com/embed/artist/abc123XYZ?si=x")!;
    expect(url).toMatch(/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+$/);
  });
});

describe("normalizeInstagram", () => {
  it("strips query params and adds the trailing slash", () => {
    expect(normalizeInstagram("https://www.instagram.com/gordimusic/?hl=en")).toBe(
      "https://www.instagram.com/gordimusic/",
    );
    expect(normalizeInstagram("https://instagram.com/bert.uk")).toBe("https://www.instagram.com/bert.uk/");
  });

  it("rejects post and reel links, which are not profiles", () => {
    expect(normalizeInstagram("https://www.instagram.com/p/Cabc123/")).toBeNull();
    expect(normalizeInstagram("https://www.instagram.com/reel/Cabc123/")).toBeNull();
  });

  it("produces a URL matching the shape artist-links.test.ts enforces", () => {
    expect(normalizeInstagram("https://instagram.com/someband?utm=x")!).toMatch(
      /^https:\/\/www\.instagram\.com\/[^/?]+\/$/,
    );
  });
});

describe("parseSocialLinks", () => {
  it("picks Spotify and Instagram out of the icon row", () => {
    expect(parseSocialLinks(gordi)).toEqual({
      spotifyUrl: "https://open.spotify.com/artist/6UBMFaCTZnL1Hr1nTOEblM",
      instagramUrl: "https://www.instagram.com/gordimusic/",
    });
  });

  // At least one act has a link titled "Facebook" pointing at YouTube, so
  // trusting the label would file links under the wrong service entirely.
  it("classifies by hostname, not by the link's title attribute", () => {
    const html =
      '<div class="socialHeaderIcons">' +
      '<a href="https://www.youtube.com/watch?v=x" title="Facebook"></a>' +
      '<a href="https://open.spotify.com/artist/abc123" title="Facebook"></a>' +
      "</div>";
    expect(parseSocialLinks(html)).toEqual({
      spotifyUrl: "https://open.spotify.com/artist/abc123",
      instagramUrl: null,
    });
  });

  it("returns nulls when there is no icon row", () => {
    expect(parseSocialLinks("<p>nothing</p>")).toEqual({ spotifyUrl: null, instagramUrl: null });
  });
});

describe("parseClock", () => {
  it("accepts both separators used in the published data", () => {
    expect(parseClock("22:40")).toBe("22:40");
    expect(parseClock("21.20")).toBe("21:20");
    expect(parseClock("9:05")).toBe("09:05");
  });

  it("rejects nonsense rather than guessing", () => {
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("20:70")).toBeNull();
    expect(parseClock("soon")).toBeNull();
  });
});

describe("parseShows", () => {
  it("reads day, venue and time from each heading", () => {
    expect(parseShows(gordi)).toEqual([
      { day: "FRIDAY", venue: "WORM 2", time: "20:20" },
      { day: "SATURDAY", venue: "PARADIJSKERK", time: "16:50" },
    ]);
  });

  // The "Go to the previous act" navigation block carries the same class but
  // wraps a container div instead of a heading.
  it("ignores the navigation block that shares the festivalShows class", () => {
    expect(parseShows(gordi).some((s) => /previous|next/i.test(s.day))).toBe(false);
  });

  it("skips a heading that isn't three parts", () => {
    expect(parseShows('<div class="festivalShows"><h3>FRIDAY | WORM 2</h3></div>')).toEqual([]);
  });
});

describe("parseActPage", () => {
  it("assembles a whole act", () => {
    const act = parseActPage(gordi, "gordi-au", "https://leftofthedial.nl/acts/gordi-au/");
    expect(act).toMatchObject({
      slug: "gordi-au",
      name: "Gordi",
      country: "AU",
      genres: "indie pop / pop",
      sourceUrl: "https://leftofthedial.nl/acts/gordi-au/",
    });
    expect(act!.shows).toHaveLength(2);
  });

  it("returns null when there's no title to key on", () => {
    expect(parseActPage("<p>not an act page</p>", "x", "https://example.com")).toBeNull();
  });
});

describe("decodeEntities", () => {
  it("handles named and numeric references", () => {
    expect(decodeEntities("Rock &amp; Roll")).toBe("Rock & Roll");
    expect(decodeEntities("caf&#233;")).toBe("café");
    expect(decodeEntities("it&#039;s")).toBe("it's");
  });
});

import { describe, expect, it } from "vitest";
import { ARTIST_LINKS, getArtistLinks } from "./artist-links";

describe("getArtistLinks", () => {
  it("returns both links for an artist that has them", () => {
    const links = getArtistLinks("Wet Leg");
    expect(links.spotify).toMatch(/^https:\/\/open\.spotify\.com\/artist\//);
    expect(links.instagram).toMatch(/^https:\/\/www\.instagram\.com\//);
  });

  // Regression guard: a naive Spotify search for "Wu Lyf" surfaces "Wu-Lu", a
  // completely different act. Wu Lyf genuinely has no Spotify presence, so it
  // must never carry a spotify link — an Instagram entry (a fan/archive
  // account) is fine, since that was sourced independently and isn't at risk
  // of the same wrong-artist mixup.
  it("has no Spotify link for Wu Lyf, never a wrong-artist match", () => {
    expect(getArtistLinks("Wu Lyf").spotify).toBeUndefined();
  });

  it("returns spotify only when instagram is unknown (partial entries work)", () => {
    const links = getArtistLinks("Halfpipe Records");
    expect(links.spotify).toMatch(/^https:\/\/open\.spotify\.com\/artist\//);
    expect(links.instagram).toBeUndefined();
  });

  it("returns an empty object for an artist with no entry at all", () => {
    expect(getArtistLinks("Some Unknown Act")).toEqual({});
  });

  it("matches case/whitespace-insensitively as a fallback", () => {
    const links = getArtistLinks("  wet leg  ");
    expect(links.spotify).toBeDefined();
  });
});

describe("ARTIST_LINKS data integrity", () => {
  const entries = Object.entries(ARTIST_LINKS);

  it("has at least one entry", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s: has at least one link, and every present link is well-formed", (_name, links) => {
    expect(links.spotify !== undefined || links.instagram !== undefined).toBe(true);

    if (links.spotify !== undefined) {
      expect(links.spotify.length).toBeGreaterThan(0);
      expect(links.spotify).toMatch(/^https:\/\/open\.spotify\.com\/artist\/[A-Za-z0-9]+$/);
      expect(links.spotify).not.toContain("?");
    }
    if (links.instagram !== undefined) {
      expect(links.instagram.length).toBeGreaterThan(0);
      expect(links.instagram).toMatch(/^https:\/\/www\.instagram\.com\/[^/?]+\/$/);
      expect(links.instagram).not.toContain("?");
    }
  });
});

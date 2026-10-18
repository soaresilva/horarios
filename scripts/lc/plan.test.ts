import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  EXPECTED_SETS_PER_ROOM,
  extractSpotifyArtist,
  LC_ARTIST_PREFIX,
  performanceId,
  planLc,
  spotifyMatches,
  validateLcSnapshot,
  type LcSet,
  type LcSnapshot,
} from "./plan";

const snapshot = JSON.parse(
  readFileSync(path.join(process.cwd(), "scripts", "data", "lc26oct.json"), "utf8"),
) as LcSnapshot;

const withSets = (sets: LcSet[], artists = snapshot.artists): LcSnapshot => ({ ...snapshot, sets, artists });
const find = (name: string) => snapshot.sets.find((s) => s.name === name)!;
const errorsAfter = (change: (sets: LcSet[]) => LcSet[]) =>
  validateLcSnapshot(withSets(change(snapshot.sets.map((s) => ({ ...s })))));

describe("the committed snapshot", () => {
  it("validates clean", () => {
    expect(validateLcSnapshot(snapshot)).toEqual([]);
  });

  it("has every poster box: 39 bands + 2 club nights", () => {
    expect(snapshot.sets.filter((s) => s.kind === "band")).toHaveLength(39);
    expect(snapshot.sets.filter((s) => s.kind === "club").map((s) => s.name)).toEqual([
      "We Love 00's (Halloween club night)",
      "Indiesleaze (DJs)",
    ]);
    expect(snapshot.sets).toHaveLength(Object.values(EXPECTED_SETS_PER_ROOM).reduce((a, b) => a + b, 0));
  });

  it("links Sandhouse to the page the site files it under (swapmeet-2), not Swapmeet's", () => {
    expect(find("Sandhouse").artistSlug).toBe("swapmeet-2");
    expect(find("Swapmeet").artistSlug).toBe("swapmeet");
  });

  it("carries no Spotify link for Really Good Time (its festival page embeds Robber Robber)", () => {
    const rgt = snapshot.artists.find((a) => a.slug === "really-good-time")!;
    expect(rgt.spotifyUrl).toBeNull();
    const spotifyIds = snapshot.artists.flatMap((a) => (a.spotifyUrl ? [a.spotifyUrl] : []));
    expect(new Set(spotifyIds).size).toBe(spotifyIds.length);
  });
});

describe("planLc", () => {
  const planned = planLc(snapshot);
  const byName = (name: string) => planned.find((p) => p.artistName === name)!;

  it("rolls after-midnight times onto the next calendar day, keeping the festival day", () => {
    const lip = byName("Lip Critic"); // Fri 23.45-0.20
    expect(lip.date).toBe("2026-10-30");
    expect(lip.startTime.toISOString()).toBe("2026-10-30T22:45:00.000Z"); // CET (UTC+1) from 25 Oct
    expect(lip.endTime.toISOString()).toBe("2026-10-30T23:20:00.000Z");
    const ulcers = byName("Mouth Ulcers"); // Sat 1.10-1.40
    expect(ulcers.date).toBe("2026-10-31");
    expect(ulcers.startTime.toISOString()).toBe("2026-11-01T00:10:00.000Z");
  });

  it("starts Saturday's daytime programme at 13:30 local", () => {
    expect(byName("Tokyo Tea Room").startTime.toISOString()).toBe("2026-10-31T12:30:00.000Z");
  });

  it("links band sets to their artist rows and leaves club nights unlinked", () => {
    expect(byName("Cardinals").artistId).toBe(`${LC_ARTIST_PREFIX}cardinals-2`);
    expect(planned.find((p) => p.artistName.startsWith("Indiesleaze"))!.artistId).toBeNull();
  });

  it("leaves bands unlinked until --fetch-artists has filled the snapshot", () => {
    expect(planLc(withSets(snapshot.sets, [])).every((p) => p.artistId === null)).toBe(true);
  });

  it("gives every set a stable, unique id", () => {
    expect(new Set(planned.map((p) => p.id)).size).toBe(planned.length);
    expect(byName("Zzzahara").id).toBe("lc26oct-p-friday-zzzahara");
    expect(performanceId(find("Indiesleaze (DJs)"))).toBe(
      "lc26oct-p-saturday-indiesleaze",
    );
  });
});

describe("validateLcSnapshot catches", () => {
  it("a dropped set (per-room count)", () => {
    expect(errorsAfter((sets) => sets.filter((s) => s.name !== "Raynor"))).toContain(
      "FRIDAY de-kring: poster shows 3 sets, snapshot has 2.",
    );
  });

  it("a set in a room that's dark that night", () => {
    const errors = errorsAfter((sets) => sets.map((s) => (s.name === "Raynor" ? { ...s, stage: "barlaeus" } : s)));
    expect(errors).toContain("Raynor (FRIDAY barlaeus): no such room on FRIDAY.");
  });

  it("an overlap inside one room", () => {
    const errors = errorsAfter((sets) => sets.map((s) => (s.name === "Cola" ? { ...s, start: "19:40" } : s)));
    expect(errors.some((e) => e.includes('"Ulrika Spacek" overlaps "Cola"'))).toBe(true);
  });

  it("an end before its start", () => {
    const errors = errorsAfter((sets) => sets.map((s) => (s.name === "Knats" ? { ...s, end: "16:10" } : s)));
    expect(errors).toContain("Knats (SATURDAY small-hall): ends (16:10) before it starts (16:20).");
  });

  it("a time off the 5-minute grid (a misread digit)", () => {
    const errors = errorsAfter((sets) => sets.map((s) => (s.name === "Hether" ? { ...s, start: "20:53" } : s)));
    expect(errors).toContain("Hether (FRIDAY small-hall): 20:53-21:20 is off the poster's 5-minute grid.");
  });

  it("a slug that points at a different act's page", () => {
    const errors = errorsAfter((sets) => sets.map((s) => (s.name === "Swapmeet" ? { ...s, artistSlug: "swapmeet-2" } : s)));
    expect(errors).toContain('Swapmeet: slug "swapmeet-2" is the page for "Sandhouse".');
  });
});

describe("artist page helpers", () => {
  it("takes the embedded Spotify artist and ignores the site-wide festival playlist", () => {
    const html = `
      <iframe src="https://open.spotify.com/embed/artist/4ABuKdLlVyzLztIFR8ETX9?utm_source=generator"></iframe>
      <iframe src="https://open.spotify.com/embed/artist/4ABuKdLlVyzLztIFR8ETX9?utm_source=generator&s"></iframe>
      <a href="https://open.spotify.com/playlist/7jpA1XEIYaNTBT9ET7Fytf?si=x">playlist</a>`;
    expect(extractSpotifyArtist(html)).toBe("https://open.spotify.com/artist/4ABuKdLlVyzLztIFR8ETX9");
  });

  it("returns null for a page without an artist player", () => {
    expect(extractSpotifyArtist('<a href="https://open.spotify.com/playlist/7jpA1XEIYaNTBT9ET7Fytf">x</a>')).toBeNull();
  });

  it("refuses a page embedding two different artists rather than guessing", () => {
    const html =
      "open.spotify.com/embed/artist/4ABuKdLlVyzLztIFR8ETX9 open.spotify.com/embed/artist/7kXZ3iTr0blml9QgUdfwGM";
    expect(() => extractSpotifyArtist(html)).toThrow(/2 different Spotify artists/);
  });

  it("matches Spotify names regardless of case, accents and punctuation, but not a different act", () => {
    expect(spotifyMatches("Tommy WÁ", "Tommy Wá")).toBe(true);
    expect(spotifyMatches("Fiona Lee", "Fiona-Lee")).toBe(true);
    expect(spotifyMatches("Robber Robber", "Really Good Time")).toBe(false);
  });

  it("decodes WordPress-escaped titles", () => {
    expect(decodeEntities("We Love 00&#8217;s &amp; more")).toBe("We Love 00’s & more");
  });
});

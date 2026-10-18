import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { staleKindNames } from "./kinds";
import type { RawShow } from "./parse";
import { instantAt, planLgw, slugify, UMBRELLAS } from "./plan";
import type { LgwSnapshot } from "./snapshot";

const pin = { slug: "x", address: "Somewhere 1, 3500 AA", lat: 52.09, lng: 5.11 };

function show(overrides: Partial<RawShow>): RawShow {
  return {
    programme: "LGW",
    day: "2026-11-07",
    showId: 1,
    name: "Tortoise",
    venue: "TivoliVredenburg",
    room: "Ronda",
    sourceStageId: 1,
    start: 19,
    end: 20,
    time: "19:00 - 20:00",
    project: null,
    projectId: null,
    slug: "tortoise",
    ...overrides,
  };
}

// Both umbrella blocks are always present, so the "umbrella gone" check
// stays quiet unless a test removes one.
const umbrellaShows = UMBRELLAS.map((u, i) =>
  show({ showId: 9000 + i, programme: u.programme, venue: u.venue, room: null, name: u.name, slug: null, start: 13, end: 20 }),
);

function snapshot(shows: RawShow[], extra: Partial<LgwSnapshot> = {}): LgwSnapshot {
  const all = [...shows, ...umbrellaShows];
  const venues = Object.fromEntries([...new Set(all.map((s) => s.venue))].map((v) => [v, pin]));
  return {
    source: [],
    fetchedAt: "2026-10-18T00:00:00Z",
    days: { LGW: [...new Set(all.filter((s) => s.programme === "LGW").map((s) => s.day))], "U?": [...new Set(all.filter((s) => s.programme === "U?").map((s) => s.day))] },
    projects: [{ id: 151, name: "Curated by aja monet" }],
    shows: all,
    venues,
    ...extra,
  };
}

describe("instantAt", () => {
  it("builds instants from the site day's Amsterdam midnight (CET, +01:00 in November)", () => {
    expect(instantAt("2026-11-05", 18.5).toISOString()).toBe("2026-11-05T17:30:00.000Z");
    // Shadia Mansour, Thursday tab, 01:00 Friday.
    expect(instantAt("2026-11-05", 25).toISOString()).toBe("2026-11-06T00:00:00.000Z");
    // CARISTA, Saturday tab, 06:30 Sunday: the 06:00 roll heuristic would
    // have put this on Saturday morning.
    expect(instantAt("2026-11-07", 30.5).toISOString()).toBe("2026-11-08T05:30:00.000Z");
    // A 70-minute set: 17:10 is 17.1666…, which must round to the minute.
    expect(instantAt("2026-11-08", 17 + 10 / 60).toISOString()).toBe("2026-11-08T16:10:00.000Z");
  });
});

describe("planLgw", () => {
  it("plans a set with the show id as its row id and the site tab as its date", () => {
    const plan = planLgw(snapshot([show({ showId: 2428, name: "CARISTA", venue: "KABUL à GoGo", room: null, start: 30.5, end: 31.5 })]));
    expect(plan.problems).toEqual([]);
    expect(plan.performances).toHaveLength(1);
    expect(plan.performances[0]).toMatchObject({
      id: "lgw26-p-2428",
      date: "2026-11-07",
      stageSlug: "kabul-a-gogo",
      series: null,
      kind: "CONCERT",
      artistId: "lgw26-a-carista",
    });
    expect(plan.performances[0].startTime.toISOString()).toBe("2026-11-08T05:30:00.000Z");
  });

  it("drops both umbrella blocks", () => {
    const plan = planLgw(snapshot([show({})]));
    expect(plan.dropped.umbrellas).toBe(2);
    expect(plan.performances.map((p) => p.artistName)).toEqual(["Tortoise"]);
  });

  it("flags an umbrella that has vanished from the site", () => {
    const snap = snapshot([show({})]);
    snap.shows = snap.shows.filter((s) => s.name !== "totally wired");
    // (It also empties that synthetic U? day, which is flagged separately.)
    expect(planLgw(snap).problems).toContainEqual(expect.stringMatching(/Umbrella "totally wired"/));
  });

  it("keeps an item listed in both timetables once, in the main programme, despite different show ids", () => {
    const base = { day: "2026-11-08", venue: "BASIS", room: null, start: 14.5, end: 21, name: "...", slug: "dotdotdot" };
    const plan = planLgw(snapshot([show({ ...base, programme: "U?", showId: 2377 }), show({ ...base, programme: "LGW", showId: 2439 })]));
    expect(plan.problems).toEqual([]);
    expect(plan.dropped.duplicates).toBe(1);
    expect(plan.performances).toHaveLength(1);
    expect(plan.performances[0]).toMatchObject({ id: "lgw26-p-2439", series: null });
  });

  it("puts a U?-only item in the U? series", () => {
    const plan = planLgw(snapshot([show({ programme: "U?", venue: "NAR", room: null, name: "o3o", slug: "macalla-o3o" })]));
    expect(plan.performances[0]).toMatchObject({ series: "U?", stageSlug: "nar" });
  });

  it("credits the project by its full name, and drops 'Film' as redundant with the FILM chip", () => {
    const plan = planLgw(
      snapshot([
        show({ showId: 1, name: "Shadia Mansour", project: "aja monet", projectId: 151 }),
        show({ showId: 2, name: "YPY", project: "COSMOS", projectId: 103, start: 21, end: 22 }),
        show({ showId: 3, name: "Blakk wi Blak...k...k", project: "Film", projectId: 145, venue: "Slachtstraat Filmtheater", room: "Zaal 1" }),
      ]),
    );
    const byName = new Map(plan.performances.map((p) => [p.artistName, p]));
    expect(byName.get("Shadia Mansour")!.host).toBe("Curated by aja monet");
    // Not in the project list: falls back to the show's own label.
    expect(byName.get("YPY")!.host).toBe("COSMOS");
    expect(byName.get("Blakk wi Blak...k...k")).toMatchObject({ host: null, kind: "FILM" });
  });

  it("makes acts by name, not by lineup page, since pages are shared", () => {
    const plan = planLgw(
      snapshot([
        show({ showId: 1, name: "Let the New Take Root", slug: "let-the-new-take-root", programme: "U?", venue: "Studio de Kiemkamer", room: null, start: 13, end: 15 }),
        show({ showId: 2, name: "Not Fit For TV", slug: "let-the-new-take-root", programme: "U?", venue: "Studio de Kiemkamer", room: null, start: 15, end: 15.75 }),
        show({ showId: 3, name: "MUSCLE by Karimah Ashadu", slug: "muscle-by-karimah-ashadu", venue: "Centraal Museum", room: "Annex", day: "2026-11-05", start: 11, end: 17 }),
        show({ showId: 4, name: "MUSCLE by Karimah Ashadu", slug: "muscle-by-karimah-ashadu", venue: "Centraal Museum", room: "Annex", day: "2026-11-06", start: 11, end: 17 }),
      ]),
    );
    expect(plan.problems).toEqual([]);
    expect(plan.artists.map((a) => a.slug)).toEqual(["let-the-new-take-root", "muscle-by-karimah-ashadu", "not-fit-for-tv"]);
    expect(plan.artists.find((a) => a.slug === "not-fit-for-tv")!.sourceUrl).toBe("https://leguesswho.com/lineup/let-the-new-take-root");
    // Both MUSCLE days share one act, so ordinals and "Also plays" link them.
    const muscle = plan.performances.filter((p) => p.artistName.startsWith("MUSCLE"));
    expect(new Set(muscle.map((p) => p.artistId)).size).toBe(1);
    expect(muscle.every((p) => p.kind === "EXHIBITION")).toBe(true);
  });

  it("refuses an unknown room rather than inventing one", () => {
    const plan = planLgw(snapshot([show({ venue: "Nieuwe Plek", room: null })]));
    expect(plan.problems).toEqual([expect.stringMatching(/Unknown room "Nieuwe Plek"/)]);
  });

  it("refuses a room whose venue has no page facts", () => {
    const snap = snapshot([show({})]);
    snap.venues.TivoliVredenburg = null;
    expect(planLgw(snap).problems).toEqual([expect.stringMatching(/no venue page facts/)]);
  });

  it("refuses overlapping sets in one room", () => {
    const plan = planLgw(snapshot([show({ showId: 1, name: "A" }), show({ showId: 2, name: "B", start: 19.5, end: 20.5 })]));
    expect(plan.problems).toEqual([expect.stringMatching(/ronda: "A \(2026-11-07\)" overlaps "B/)]);
  });

  it("refuses a day tab with no shows", () => {
    const snap = snapshot([show({})]);
    snap.days.LGW.push("2026-11-09");
    expect(planLgw(snap).problems).toEqual([expect.stringMatching(/2026-11-09 has a day tab but no shows/)]);
  });

  it("flags a long item the kind rules call a concert", () => {
    const plan = planLgw(snapshot([show({ name: "Mystery Installation", start: 11, end: 17 })]));
    expect(plan.problems).toEqual([expect.stringMatching(/"Mystery Installation" runs 6h/)]);
  });
});

describe("slugify", () => {
  it("handles accents, apostrophes and names with no letters", () => {
    expect(slugify("Ángeles Toledano")).toBe("angeles-toledano");
    expect(slugify("Let's Kii")).toBe("lets-kii");
    expect(slugify("...")).toBe("untitled");
  });
});

describe("the committed snapshot (scripts/data/lgw26.json)", () => {
  const committed = JSON.parse(
    readFileSync(path.join(__dirname, "..", "data", "lgw26.json"), "utf8"),
  ) as LgwSnapshot;
  const plan = planLgw(committed);

  it("plans with no problems, and every hand-listed kind name is still in it", () => {
    expect(plan.problems).toEqual([]);
    expect(staleKindNames(committed.shows)).toEqual([]);
  });

  it("has unique performance ids", () => {
    expect(new Set(plan.performances.map((p) => p.id)).size).toBe(plan.performances.length);
  });

  it("puts the overnight 24 HOUR DUB sets on the Saturday grid, running into Sunday morning", () => {
    const overnight = plan.performances.filter((p) => p.stageSlug === "kabul-a-gogo" && p.date === "2026-11-07");
    const last = overnight.reduce((a, b) => (a.endTime > b.endTime ? a : b));
    expect(last.endTime.toISOString()).toBe("2026-11-08T07:30:00.000Z"); // 08:30 Sunday, Amsterdam
    const sundayFirst = plan.performances
      .filter((p) => p.stageSlug === "kabul-a-gogo" && p.date === "2026-11-08")
      .reduce((a, b) => (a.startTime < b.startTime ? a : b));
    // The two tabs meet exactly, with no gap and no overlap.
    expect(sundayFirst.startTime.toISOString()).toBe(last.endTime.toISOString());
  });
});

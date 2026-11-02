import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  artistSlugCandidates,
  artistUrl,
  clockMinutes,
  CLOSING_SET,
  CORE_STAGES,
  instantAt,
  NOT_ON_PLENITUDE,
  pageTitleAct,
  performanceId,
  planPs,
  POSTER_ACTS,
  posterTier,
  sameAct,
  STAGES_BY_DAY,
  validatePsSnapshot,
  type PsDay,
  type PsSet,
  type PsSnapshot,
} from "./plan";

const snapshot = JSON.parse(
  readFileSync(path.join(process.cwd(), "scripts", "data", "ps27.json"), "utf8"),
) as PsSnapshot;

const find = (name: string) => snapshot.sets.find((s) => s.name === name)!;
const errorsAfter = (change: (sets: PsSet[]) => PsSet[]) =>
  validatePsSnapshot({ ...snapshot, sets: change(snapshot.sets.map((s) => ({ ...s }))) });
const editing = (name: string, patch: Partial<PsSet>) =>
  errorsAfter((sets) => sets.map((s) => (s.name === name ? { ...s, ...patch } : s)));

describe("the committed snapshot", () => {
  it("validates clean", () => {
    expect(validatePsSnapshot(snapshot)).toEqual([]);
  });

  it("places every poster act once", () => {
    const poster = Object.values(POSTER_ACTS).flat(2);
    expect(poster).toHaveLength(150);
    expect(new Set(poster).size).toBe(150);
    expect(snapshot.sets).toHaveLength(150);
  });

  it("keeps Diogo's seven stages full, and uses the side stages only for the overflow", () => {
    for (const day of ["THU", "FRI", "SAT"] as const) {
      const onCore = snapshot.sets.filter((s) => s.day === day && CORE_STAGES.includes(s.stage));
      expect(onCore.length).toBeGreaterThanOrEqual(34);
      expect(onCore.length).toBeLessThanOrEqual(36);
    }
  });

  it("has one row per stage on Wednesday and Sunday, where only Parc del Fòrum exists", () => {
    expect(STAGES_BY_DAY.WED).toEqual(["parc-del-forum"]);
    expect(STAGES_BY_DAY.SUN).toEqual(["parc-del-forum"]);
    expect(find("Underworld").end).toBe("23:05");
    expect(find("Richie Hawtin x Four Tet x Dixon").start).toBe("15:00");
  });

  it("closes the main stages on the poster's closing set", () => {
    const mains = snapshot.sets.filter((s) => s.day === "SAT" && ["estrella-damm", "revolut"].includes(s.stage));
    const last = mains.reduce((a, b) => (clockMinutes(a.end) > clockMinutes(b.end) ? a : b));
    expect(last.name).toBe(CLOSING_SET);
  });
});

describe("Plenitude", () => {
  it("only has DJs: none of the bands and live acts that sat there in the first draft", () => {
    const onPlenitude = snapshot.sets.filter((s) => s.stage === "plenitude").map((s) => s.name);
    expect(onPlenitude.length).toBeGreaterThanOrEqual(12);
    expect(onPlenitude.filter((name) => NOT_ON_PLENITUDE.includes(name))).toEqual([]);
    expect(NOT_ON_PLENITUDE.every((name) => snapshot.sets.some((s) => s.name === name))).toBe(true);
  });

  it("runs from the early evening, so it isn't left empty where the bands were", () => {
    for (const day of ["THU", "FRI", "SAT"] as const) {
      const starts = snapshot.sets.filter((s) => s.day === day && s.stage === "plenitude").map((s) => s.start);
      expect(starts).toContain("18:00");
    }
  });
});

describe("Saturday's small-print stages", () => {
  const where = (name: string) => find(name).stage;

  it("keeps club music off the Auditori, which is for seated sets", () => {
    expect(where("Marta Salogni Live")).toBe("plenitude");
    expect(where("Jump Source Live")).toBe("plenitude");
  });

  it("puts the two guitar bands on the small stages", () => {
    expect(where("Victoryland")).toBe("port");
    expect(where("Warning")).toBe("schwarzkopf");
    expect(find("Victoryland").start < "20:00").toBe(true);
  });
});

describe("artist links", () => {
  const link = (name: string) => snapshot.artists.find((a) => a.slug === find(name).artistSlug)!;

  it("gives every act but Sunday's three-way block a page, opened as part of this edition", () => {
    expect(snapshot.sets.filter((s) => !s.artistSlug).map((s) => s.name)).toEqual(["Richie Hawtin x Four Tet x Dixon"]);
    expect(link("CHVRCHES").sourceUrl).toBe(
      "https://www.primaverasound.com/en/artist/chvrches?e=primavera-sound-2027-barcelona",
    );
  });

  it("links the acts whose slug the site doesn't derive from the poster", () => {
    expect(find("Fontaines D.C.").artistSlug).toBe("fontaines-dc");
    expect(find("Mushka").artistSlug).toBe("mushkaa");
    expect(find("@").artistSlug).toBe("at");
    expect(find("Haute & Freddy").artistSlug).toBe("haute-and-freddy");
  });

  it("plans each performance against its artist row", () => {
    const planned = planPs(snapshot).find((p) => p.id === performanceId(find("CHVRCHES")))!;
    expect(planned.artistId).toBe("ps27-a-chvrches");
  });

  it("fails a link to the wrong act", () => {
    const errors = validatePsSnapshot({
      ...snapshot,
      artists: snapshot.artists.map((a) => (a.slug === "napa" ? { ...a, name: "Napalm Death" } : a)),
    });
    expect(errors).toContainEqual(expect.stringContaining('slug "napa" is the page for "Napalm Death"'));
  });

  it("fails an act with no page once pages have been fetched", () => {
    expect(editing("Napa", { artistSlug: undefined })).toContainEqual("Napa: no artist page.");
  });

  it("needs no pages before they've been fetched", () => {
    const bare = { ...snapshot, artists: [], sets: snapshot.sets.map((s) => ({ ...s, artistSlug: undefined })) };
    expect(validatePsSnapshot(bare)).toEqual([]);
  });
});

describe("artist slugs", () => {
  it("spells & out and tries the name without the Live tag", () => {
    expect(artistSlugCandidates("Mark Fell & RP Boo Live")).toEqual(["mark-fell-and-rp-boo-live", "mark-fell-and-rp-boo"]);
    expect(artistSlugCandidates("Oceanic (Live AV)")).toEqual(["oceanic-live-av", "oceanic"]);
  });

  it("builds the edition link", () => {
    expect(artistUrl("doechii")).toBe("https://www.primaverasound.com/en/artist/doechii?e=primavera-sound-2027-barcelona");
  });

  it("reads the act out of the page title, whatever follows it", () => {
    const title = (t: string) => pageTitleAct(`<head><title>${t}</title></head>`);
    expect(title("CHVRCHES (GB)")).toBe("CHVRCHES");
    expect(title("Brutalismus 3000 b2b ISOxo (DE-US)")).toBe("Brutalismus 3000 b2b ISOxo");
    expect(title("S.A.S.S (Saoirse, Moxie, Peach, Shanti Celeste)")).toBe("S.A.S.S");
    expect(title("Haute &amp; Freddy (ES)")).toBe("Haute & Freddy");
    expect(title("Primavera Sound - Error 404")).toBe("Primavera Sound - Error 404");
  });

  it("matches the poster's name to the page's, and nothing similar", () => {
    expect(sameAct("King Gizzard & The Lizard Wizard", "King Gizzard and the Lizard Wizard")).toBe(true);
    expect(sameAct("Oceanic live A/V", "Oceanic (Live AV)")).toBe(true);
    expect(sameAct("aLex vs aLex", "Alex vs Alex")).toBe(true);
    expect(sameAct("Napalm Death", "Napa")).toBe(false);
    expect(sameAct("Mushkaa", "Mushka")).toBe(false);
    expect(sameAct("@", "@")).toBe(true);
    expect(sameAct("!", "@")).toBe(false);
  });
});

describe("instantAt", () => {
  it("is Barcelona time, summer offset", () => {
    expect(instantAt("2027-06-03", "21:55").toISOString()).toBe("2027-06-03T19:55:00.000Z");
  });

  it("puts small hours on the next calendar morning", () => {
    expect(instantAt("2027-06-03", "01:20").toISOString()).toBe("2027-06-03T23:20:00.000Z");
  });

  it("keeps a 06:00 end after its 04:30 start, which fromFestivalDayTime can't", () => {
    const closer = planPs(snapshot).find((p) => p.id === performanceId(find("Joy Orbison")))!;
    expect(closer.startTime.toISOString()).toBe("2027-06-04T02:30:00.000Z");
    expect(closer.endTime.toISOString()).toBe("2027-06-04T04:00:00.000Z");
  });
});

describe("performanceId", () => {
  it("survives a name with nothing to slug", () => {
    expect(performanceId({ day: "FRI", name: "@" })).toBe("ps27-p-fri-at");
  });

  it("is unaffected by where the guess moves the act", () => {
    const moved: PsSet = { ...find("Doechii"), stage: "port" };
    expect(performanceId(moved)).toBe(performanceId(find("Doechii")));
  });
});

describe("posterTier", () => {
  it("reads the poster's font size", () => {
    expect(posterTier("THU", "Fontaines D.C.")).toBe(1);
    expect(posterTier("SAT", "Warning")).toBe(5);
  });

  it("is undefined on the wrong day", () => {
    expect(posterTier("THU", "Doechii")).toBeUndefined();
  });
});

describe("a bad snapshot fails", () => {
  it("drops an act", () => {
    expect(errorsAfter((sets) => sets.filter((s) => s.name !== "Piss"))).toContainEqual(expect.stringContaining("Piss"));
  });

  it("places an act twice", () => {
    expect(errorsAfter((sets) => [...sets, { ...find("Piss"), stage: "plenitude", start: "19:00", end: "19:30" }])).toContainEqual(
      expect.stringContaining("placed 2 times"),
    );
  });

  it("moves an act off its poster day", () => {
    const errors = editing("Doechii", { day: "FRI" });
    expect(errors).toContainEqual(expect.stringContaining("not on that day's poster"));
  });

  it("adds an act the poster doesn't have", () => {
    expect(errorsAfter((sets) => [...sets, { ...find("Piss"), name: "Taylor Swift", start: "19:00", end: "19:30", stage: "plenitude" }])).toContainEqual(
      expect.stringContaining("Taylor Swift"),
    );
  });

  it("invents a stage", () => {
    expect(editing("Piss", { stage: "mirage" })).toContainEqual(expect.stringContaining("no such stage"));
  });

  it("uses a regular stage on Wednesday", () => {
    expect(editing("Fades", { stage: "port" })).toContainEqual(expect.stringContaining("no such stage"));
  });

  it("overlaps on a stage", () => {
    const { start, end } = find("Robyn");
    expect(editing("Wallows", { start, end })).toContainEqual(expect.stringContaining("overlaps"));
  });

  it("overlaps across the two main stages", () => {
    expect(editing("Robyn", { start: "20:30", end: "21:30" })).toContainEqual(expect.stringContaining("main stages"));
  });

  it("goes off the 5-minute grid", () => {
    expect(editing("Piss", { start: "01:37" })).toContainEqual(expect.stringContaining("5-minute"));
  });

  it("ends before it starts", () => {
    expect(editing("Piss", { end: "01:00" })).toContainEqual(expect.stringContaining("before it starts"));
  });

  it("leaves a set unexplained", () => {
    expect(editing("Piss", { why: " " })).toContainEqual(expect.stringContaining("no reasoning"));
  });

  it("puts a band on Plenitude", () => {
    expect(editing("Napa", { stage: "plenitude", start: "12:00", end: "12:30" })).toContainEqual(
      expect.stringContaining("Plenitude is a DJ stage"),
    );
  });

  it("puts a headliner off the mains", () => {
    expect(editing("Robyn", { stage: "port", start: "13:00", end: "13:30" })).toContainEqual(expect.stringContaining("main stage"));
  });

  it("puts a headliner outside prime time", () => {
    expect(editing("Doechii", { start: "19:00", end: "20:00" })).toContainEqual(expect.stringContaining("prime time"));
  });

  it("puts a mid-bill name on a side stage", () => {
    expect(editing("Friko", { stage: "plenitude", start: "12:00", end: "12:30" })).toContainEqual(expect.stringContaining("side stage"));
  });

  it("puts the smallest print on a big stage", () => {
    expect(editing("Warning", { stage: "occident", start: "12:00", end: "12:30" })).toContainEqual(expect.stringContaining("smallest print"));
  });

  it("runs a main stage past the closing set", () => {
    expect(editing("Prospa", { start: "05:05", end: "05:30" })).toContainEqual(expect.stringContaining("after the closing set"));
  });

  it("moves the closing set off the mains", () => {
    expect(editing(CLOSING_SET, { stage: "cupra-pulse" })).toContainEqual(expect.stringContaining("closing set"));
  });
});

// Fails if STAGES_BY_DAY ever drifts from the migration that owns the rows.
it("only names stages the migration creates", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "prisma", "migrations", "20261102120000_add_published_and_ps27_festival", "migration.sql"),
    "utf8",
  );
  for (const stage of new Set((Object.keys(STAGES_BY_DAY) as PsDay[]).flatMap((day) => STAGES_BY_DAY[day]))) {
    expect(migration).toContain(`'ps27-${stage}'`);
  }
});

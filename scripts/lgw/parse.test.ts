import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clockOf, daysOf, hydrate, parseStageLabel, parseTimetableData, projectsOf } from "./parse";

// Trimmed real Livewire snapshots (`data` half), fetched 2026-10-18 and cut
// down to a couple of rooms each.
const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", name), "utf8")) as unknown;

describe("hydrate", () => {
  it("unwraps Livewire's [value, {s:'arr'}] pairs at every depth", () => {
    // PHP ["a" => [1, [2]]] dehydrates to [{a: [[1, [[2], {s}]], {s}]}, {s}].
    expect(hydrate([{ a: [[1, [[2], { s: "arr" }]], { s: "arr" }] }, { s: "arr" }])).toEqual({ a: [1, [2]] });
  });

  it("leaves an ordinary two-element array alone", () => {
    expect(hydrate([1, { s: "x" }])).toEqual([1, { s: "x" }]);
  });
});

describe("parseStageLabel", () => {
  it("splits a venue and its room", () => {
    expect(parseStageLabel('<span class="venue">TivoliVredenburg</span><span>Grote Zaal</span>')).toEqual({
      venue: "TivoliVredenburg",
      room: "Grote Zaal",
    });
  });

  it("keeps a slash inside one span as part of the name", () => {
    expect(parseStageLabel('<span class="venue">TivoliVredenburg</span><span>COSMOS Foyer / Pandora Studio</span>').room).toBe(
      "COSMOS Foyer / Pandora Studio",
    );
    expect(parseStageLabel("<span>BAK / Basecamp</span>")).toEqual({ venue: "BAK / Basecamp", room: null });
  });

  it("decodes entities", () => {
    expect(parseStageLabel("<span>dB&#039;s</span><span>Bar Stage</span>").venue).toBe("dB's");
  });

  it("throws on a label with no text", () => {
    expect(() => parseStageLabel("<div></div>")).toThrow(/Unreadable/);
  });
});

describe("clockOf", () => {
  it("wraps hours past midnight onto the clock", () => {
    expect(clockOf(18.5)).toBe("18:30");
    expect(clockOf(25.75)).toBe("01:45");
    expect(clockOf(30.5)).toBe("06:30");
    expect(clockOf(17 + 10 / 60)).toBe("17:10");
  });
});

describe("parseTimetableData on real snapshots", () => {
  it("reads Thursday's Grote Zaal, including Shadia Mansour at 01:00 keyed as 25", () => {
    const shows = parseTimetableData(fixture("lgw-thu-grote-zaal.json"), "LGW", "2026-11-05");
    expect(shows.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Mohammed el-Kurd", "Alsarah & The Nubatones", "aja monet", "Shadia Mansour"]),
    );
    const shadia = shows.find((s) => s.name === "Shadia Mansour")!;
    expect(shadia).toMatchObject({
      venue: "TivoliVredenburg",
      room: "Grote Zaal",
      start: 25,
      end: 25.75,
      time: "01:00 - 01:45",
      project: "aja monet",
      projectId: 151,
      slug: "shadia-mansour",
    });
  });

  it("keeps Saturday-tab 24 HOUR DUB sets after 05:00 keyed past 29, which is what makes them unambiguous", () => {
    const shows = parseTimetableData(fixture("lgw-sat-kabul-was.json"), "LGW", "2026-11-07");
    const carista = shows.find((s) => s.name === "CARISTA")!;
    expect(carista).toMatchObject({ venue: "KABUL à GoGo", room: null, start: 30.5, end: 31.5, day: "2026-11-07" });
    const herve = shows.find((s) => s.name === "Hervé")!;
    expect(herve).toMatchObject({ venue: "WAS.", start: 29, end: 31 });
  });

  it("keys Sunday-tab morning sets from Sunday's own midnight", () => {
    const shows = parseTimetableData(fixture("lgw-sun-kabul-basis.json"), "LGW", "2026-11-08");
    expect(shows.find((s) => s.name.startsWith("Kelman Duran"))).toMatchObject({ start: 8.5, end: 9.5 });
    expect(shows.find((s) => s.name === "...")).toMatchObject({ venue: "BASIS", slug: "dotdotdot", projectId: 165 });
  });

  it("reads a show with no lineup page as slug null", () => {
    const shows = parseTimetableData(fixture("u-sun-basis-voorkamer.json"), "U?", "2026-11-08");
    expect(shows.every((s) => s.programme === "U?")).toBe(true);
    expect(shows.find((s) => s.name === "Community dinner")).toMatchObject({ venue: "De Voorkamer", slug: "when-cultures-meet" });
  });

  it("throws when a clock label disagrees with its decimal key", () => {
    const data = JSON.parse(JSON.stringify(fixture("lgw-thu-grote-zaal.json")));
    const text = JSON.stringify(data).replace('"time":"01:00 - 01:45"', '"time":"01:00 - 02:00"');
    expect(() => parseTimetableData(JSON.parse(text), "LGW", "2026-11-05")).toThrow(/labelled "01:00 - 02:00"/);
  });

  it("throws when the page has no day data at all", () => {
    expect(() => parseTimetableData({ background: "" }, "LGW", "2026-11-05")).toThrow(/no "day" key/);
  });
});

describe("daysOf / projectsOf", () => {
  it("lists the day tabs and full project names", () => {
    const data = fixture("lgw-thu-grote-zaal.json");
    expect(daysOf(data)).toEqual(["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(projectsOf(data)).toContainEqual({ id: 151, name: "Curated by aja monet" });
    expect(daysOf(fixture("u-sun-basis-voorkamer.json"))).toEqual(["2026-11-07", "2026-11-08"]);
  });
});

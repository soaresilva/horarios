import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkAgainstMainProgramme,
  EXPECTED_BANDS,
  EXPECTED_EXTRAS,
  findOverlaps,
  nameKey,
  planTouo,
  TOUO_SERIES,
  validateTouoSnapshot,
  type Slot,
  type TouoSet,
  type TouoSnapshot,
} from "./plan";

const read = <T,>(file: string) =>
  JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "data", file), "utf8")) as T;

const snapshot = read<TouoSnapshot>("touo26.json");
const lotdArtists = read<{ acts: { slug: string; name: string }[] }>("lotd26.json").acts.map((a) => ({
  id: `lotd26-a-${a.slug}`,
  name: a.name,
}));

function set(overrides: Partial<TouoSet> = {}): TouoSet {
  return {
    day: "FRIDAY",
    venue: "PLATO",
    host: "Salmon on a Leash",
    artist: "Some Act",
    pdfName: "SOME ACT",
    country: "NL",
    start: "12:30",
    end: "13:00",
    kind: "band",
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);
function slot(id: string, stageKey: string, start: string, end: string): Slot {
  return { id, label: id, stageKey, startTime: at(start), endTime: at(end) };
}

describe("committed touo26.json snapshot (integrity eval)", () => {
  it("matches the per-room block counts read off the PDF", () => {
    expect(validateTouoSnapshot(snapshot.sets)).toEqual([]);
  });

  it(`has ${EXPECTED_BANDS} band sets and ${EXPECTED_EXTRAS} extras`, () => {
    expect(snapshot.sets.filter((s) => s.kind === "band")).toHaveLength(EXPECTED_BANDS);
    expect(snapshot.sets.filter((s) => s.kind === "extra")).toHaveLength(EXPECTED_EXTRAS);
  });

  it("has no two side-programme sets overlapping in one room", () => {
    const planned = planTouo(snapshot.sets, lotdArtists);
    expect(
      findOverlaps(planned.map((p) => ({ id: p.id, label: p.id, stageKey: p.stageSlug, startTime: p.startTime, endTime: p.endTime }))),
    ).toEqual([]);
  });
});

describe("planTouo", () => {
  const planned = planTouo(snapshot.sets, lotdArtists);

  it("gives every set a unique, prefixed, deterministic id", () => {
    const ids = planned.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("touo26-p-"))).toBe(true);
    expect(planTouo(snapshot.sets, lotdArtists).map((p) => p.id)).toEqual(ids);
    expect(ids).toContain("touo26-p-daufodt-friday-v11");
  });

  it("links exactly the 34 acts that are also on the LOTD lineup", () => {
    const linkedActs = new Set(planned.filter((p) => p.artistId).map((p) => p.artistId));
    expect(linkedActs.size).toBe(34);
    expect(planned.filter((p) => p.artistId)).toHaveLength(38); // four of them play TOUO twice
    // San Jose joined the main lineup on 2026-10-22, in Esmeralda Road's slots.
    expect(planned.find((p) => p.id === "touo26-p-san-jose-friday-v11")?.artistId).toBe("lotd26-a-san-jose-uk");
    // Spot checks for the names that only match after normalisation.
    const byArtist = new Map(planned.map((p) => [p.artistId, p.artistName]));
    expect(byArtist.get("lotd26-a-daufodt-no")).toBe("DAUFØDT");
    expect(planned.find((p) => p.id.startsWith("touo26-p-atticomatic-"))?.artistId).not.toBeNull();
    expect(planned.find((p) => p.id.startsWith("touo26-p-lawn-chair-"))?.artistId).not.toBeNull();
  });

  it("leaves TOUO-only acts and the extras unlinked under their PDF display name", () => {
    const rockpool = planned.find((p) => p.id.startsWith("touo26-p-rockpool-dramas-"))!;
    expect(rockpool.artistId).toBeNull();
    expect(rockpool.artistName).toBe("Rockpool Dramas");
    const workshop = planned.find((p) => p.artistName === "Electronic Music Workshop")!;
    expect(workshop.artistId).toBeNull();
    expect(workshop.stageSlug).toBe("tr-down");
  });

  it("anchors daytime sets to Amsterdam summer time on the right festival day", () => {
    const library = planned.find((p) => p.id === "touo26-p-library-card-saturday-arminius-down")!;
    expect(library.date).toBe("2026-10-24");
    expect(library.startTime.toISOString()).toBe("2026-10-24T09:45:00.000Z"); // 11:45 CEST
    expect(library.endTime.toISOString()).toBe("2026-10-24T10:15:00.000Z");
    expect(library.series).toBe(TOUO_SERIES);
    expect(library.host).toBe("3voor12");
  });

  it("keeps Sticker Night on Friday's tab while rolling its clock past midnight", () => {
    const sticker = planned.find((p) => p.artistName === "Sticker Night")!;
    expect(sticker.date).toBe("2026-10-23");
    expect(sticker.stageSlug).toBe("rotown");
    expect(sticker.startTime.toISOString()).toBe("2026-10-23T22:00:00.000Z"); // Sat 00:00 CEST
    expect(sticker.endTime.toISOString()).toBe("2026-10-24T02:00:00.000Z"); // Sat 04:00 CEST
  });
});

describe("nameKey", () => {
  it("ignores case, accents, Scandinavian ø and punctuation", () => {
    expect(nameKey("DAUFØDT")).toBe(nameKey("Daufødt"));
    expect(nameKey("AtticOmatic")).toBe(nameKey("Atticomatic"));
    expect(nameKey("Maicín")).toBe("maicin");
    expect(nameKey("PleasureInc.")).toBe("pleasureinc");
  });
});

describe("validateTouoSnapshot", () => {
  it("reports a band set outside the daytime window", () => {
    const sets = snapshot.sets.map((s) => (s.artist === "Fellatio" && s.day === "FRIDAY" ? { ...s, end: "16:30" } : s));
    expect(validateTouoSnapshot(sets)).toContainEqual(expect.stringMatching(/Fellatio .* is outside 11:45-16:00/));
  });

  it("reports a room whose count no longer matches the PDF", () => {
    const sets = snapshot.sets.filter((s) => !(s.venue === "TRAMHUIS" && s.artist === "Max Sloan"));
    const errors = validateTouoSnapshot(sets);
    expect(errors).toContainEqual("FRIDAY TRAMHUIS: PDF shows 2 sets, snapshot has 1.");
    expect(errors).toContainEqual(`Expected ${EXPECTED_BANDS} band sets, snapshot has ${EXPECTED_BANDS - 1}.`);
  });

  it("reports a room the PDF doesn't have", () => {
    const errors = validateTouoSnapshot([...snapshot.sets, set({ venue: "DE PLAATS" })]);
    expect(errors).toContainEqual("FRIDAY DE PLAATS: PDF shows 0 sets, snapshot has 1.");
  });

  it("reports a malformed time", () => {
    expect(validateTouoSnapshot([set({ start: "1230" })])).toContainEqual("Some Act: malformed time 1230-13:00.");
  });
});

describe("findOverlaps", () => {
  it("flags two sets sharing a room and time", () => {
    expect(
      findOverlaps([
        slot("a", "plato", "2026-10-23T10:30:00Z", "2026-10-23T11:00:00Z"),
        slot("b", "plato", "2026-10-23T10:45:00Z", "2026-10-23T11:15:00Z"),
      ]),
    ).toEqual(['plato: "a" overlaps "b"']);
  });

  it("allows back-to-back sets and the same time in different rooms", () => {
    expect(
      findOverlaps([
        slot("a", "plato", "2026-10-23T10:30:00Z", "2026-10-23T11:00:00Z"),
        slot("b", "plato", "2026-10-23T11:00:00Z", "2026-10-23T11:30:00Z"),
        slot("c", "rotown", "2026-10-23T10:30:00Z", "2026-10-23T11:00:00Z"),
      ]),
    ).toEqual([]);
  });
});

describe("checkAgainstMainProgramme", () => {
  const sticker = slot("sticker", "rotown", "2026-10-23T22:00:00Z", "2026-10-24T02:00:00Z");

  it("clips a LOTD set whose estimated end runs into a TOUO start (The Guest List / Sticker Night)", () => {
    const guestList = slot("guest-list", "rotown", "2026-10-23T21:30:00Z", "2026-10-23T22:10:00Z");
    expect(checkAgainstMainProgramme([guestList], [sticker])).toEqual({
      clashes: [],
      clips: [{ id: "guest-list", label: "guest-list", endTime: at("2026-10-23T22:00:00Z") }],
    });
  });

  it("treats a LOTD start inside a TOUO set as a real clash", () => {
    const late = slot("late", "rotown", "2026-10-23T23:00:00Z", "2026-10-23T23:40:00Z");
    const result = checkAgainstMainProgramme([late], [sticker]);
    expect(result.clashes).toEqual(['rotown: "late" starts during "sticker"']);
    expect(result.clips).toEqual([]);
  });

  it("clips to the earliest TOUO start when several follow one LOTD set", () => {
    const long = slot("long", "plato", "2026-10-23T09:00:00Z", "2026-10-23T12:00:00Z");
    const result = checkAgainstMainProgramme(
      [long],
      [
        slot("t2", "plato", "2026-10-23T11:00:00Z", "2026-10-23T11:30:00Z"),
        slot("t1", "plato", "2026-10-23T10:30:00Z", "2026-10-23T11:00:00Z"),
      ],
    );
    expect(result.clips).toEqual([{ id: "long", label: "long", endTime: at("2026-10-23T10:30:00Z") }]);
  });

  it("ignores sets in other rooms and sets that end before the TOUO one starts", () => {
    expect(
      checkAgainstMainProgramme(
        [
          slot("elsewhere", "uniek", "2026-10-23T21:30:00Z", "2026-10-23T22:10:00Z"),
          slot("earlier", "rotown", "2026-10-23T20:00:00Z", "2026-10-23T20:40:00Z"),
        ],
        [sticker],
      ),
    ).toEqual({ clashes: [], clips: [] });
  });
});

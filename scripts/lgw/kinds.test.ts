import { describe, expect, it } from "vitest";
import { KIND_BY_NAME, kindOf, kindProblems, LONG_CONCERTS, staleKindNames } from "./kinds";

const item = (name: string, project: string | null = null, start = 20, end = 21) => ({ name, project, start, end });

describe("kindOf", () => {
  it("uses the hand list first", () => {
    expect(kindOf(item("MUSCLE by Karimah Ashadu"))).toBe("EXHIBITION");
    // Hand list beats the Summit rule: TIMES is screenings, not talks.
    expect(kindOf(item("TIMES Documentaries", "Sound & Culture Summit"))).toBe("FILM");
  });

  it("reads the Film project as FILM", () => {
    expect(kindOf(item("Ensayo #1 (tiempos de guerra)", "Film"))).toBe("FILM");
  });

  it("reads a 'Workshop:' title as WORKSHOP, before the Summit rule", () => {
    expect(kindOf(item("Workshop: Artist Visa Toolkit (RSVP)", "Sound & Culture Summit"))).toBe("WORKSHOP");
  });

  it("reads the rest of the Sound & Culture Summit as TALK", () => {
    expect(kindOf(item("How To Run a Label", "Sound & Culture Summit"))).toBe("TALK");
  });

  it("defaults to CONCERT", () => {
    expect(kindOf(item("Tortoise"))).toBe("CONCERT");
    expect(kindOf(item("YPY", "COSMOS"))).toBe("CONCERT");
  });

  it("keeps a host's music slots as concerts even when they share its lineup page", () => {
    expect(kindOf(item("Not Fit For TV"))).toBe("CONCERT");
    expect(kindOf(item("Let the New Take Root"))).toBe("OTHER");
  });
});

describe("kindProblems", () => {
  const everyListedName = [...Object.keys(KIND_BY_NAME), ...LONG_CONCERTS].map((n) => item(n));

  it("is quiet when every listed name is present and nothing long is unclassified", () => {
    expect(kindProblems([...everyListedName, item("WAI8", "KMRU presents WAI8", 15, 23)])).toEqual([]);
  });

  it("flags an item of three hours or more that falls through to CONCERT", () => {
    expect(kindProblems([...everyListedName, item("New Day-Long Thing", null, 12, 15)])).toEqual([
      expect.stringMatching(/"New Day-Long Thing" runs 3h and is classified CONCERT/),
    ]);
  });

  it("lets a listed long concert through", () => {
    expect(kindProblems([...everyListedName, item("Eris Drew & Octo Octa", "WAS.", 25, 29)])).toEqual([]);
  });

});

describe("staleKindNames", () => {
  const everyListedName = [...Object.keys(KIND_BY_NAME), ...LONG_CONCERTS].map((n) => item(n));

  it("is empty when every hand-listed name is in the timetable", () => {
    expect(staleKindNames(everyListedName)).toEqual([]);
  });

  it("flags a hand-list entry the timetable no longer has, which means a rename", () => {
    const missing = everyListedName.filter((s) => s.name !== "The Temple");
    expect(staleKindNames(missing)).toEqual([expect.stringMatching(/"The Temple" is in kinds.ts but no longer/)]);
  });
});

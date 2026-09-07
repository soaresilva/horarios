import { describe, expect, it } from "vitest";
import { showOrdinals } from "./shows";

const at = (iso: string) => new Date(`${iso}+02:00`);

describe("showOrdinals", () => {
  // Most Left of the Dial acts play more than once across the week, and the
  // whole point of the badge is that missing one isn't final — so the count
  // has to span the festival, not the day being viewed.
  it("numbers an act's shows chronologically across different days", () => {
    const ordinals = showOrdinals([
      { id: "p2", artistId: "a1", artistName: "Gordi", startTime: at("2026-10-24T16:50:00") },
      { id: "p1", artistId: "a1", artistName: "Gordi", startTime: at("2026-10-23T20:20:00") },
      { id: "p3", artistId: "a1", artistName: "Gordi", startTime: at("2026-10-24T22:00:00") },
    ]);
    expect(ordinals.get("p1")).toEqual({ index: 1, total: 3 });
    expect(ordinals.get("p2")).toEqual({ index: 2, total: 3 });
    expect(ordinals.get("p3")).toEqual({ index: 3, total: 3 });
  });

  it("reports a single-show act as 1 of 1, so the caller can hide the badge", () => {
    const ordinals = showOrdinals([
      { id: "p1", artistId: "a9", artistName: "Les Savy Fav", startTime: at("2026-10-24T23:30:00") },
    ]);
    expect(ordinals.get("p1")).toEqual({ index: 1, total: 1 });
  });

  // Two different acts can share a display name; the imported id is what
  // actually identifies them, so they must not be merged into one run.
  it("keeps distinct artistIds apart even when the display names match", () => {
    const ordinals = showOrdinals([
      { id: "p1", artistId: "a1", artistName: "Quarto Mundo", startTime: at("2026-10-23T19:00:00") },
      { id: "p2", artistId: "a2", artistName: "Quarto Mundo", startTime: at("2026-10-24T19:00:00") },
    ]);
    expect(ordinals.get("p1")).toEqual({ index: 1, total: 1 });
    expect(ordinals.get("p2")).toEqual({ index: 1, total: 1 });
  });

  // Paredes de Coura has no Artist rows at all, so the fallback key has to
  // group by name — and tolerate stray casing/whitespace while doing it.
  it("falls back to a normalised name when there is no artistId", () => {
    const ordinals = showOrdinals([
      { id: "p1", artistId: null, artistName: "Dupplo", startTime: at("2026-08-16T04:20:00") },
      { id: "p2", artistId: null, artistName: " dupplo ", startTime: at("2026-08-16T15:00:00") },
    ]);
    expect(ordinals.get("p1")).toEqual({ index: 1, total: 2 });
    expect(ordinals.get("p2")).toEqual({ index: 2, total: 2 });
  });

  it("returns an empty map for an empty schedule", () => {
    expect(showOrdinals([]).size).toBe(0);
  });
});

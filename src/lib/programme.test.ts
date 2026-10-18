import { describe, expect, it } from "vitest";
import { DEFAULT_PROGRAMME_COPY, programmeCopy } from "@/lib/festival-copy";
import { contextLine, kindLabel } from "@/lib/programme";

describe("kindLabel", () => {
  it("has no label for a concert and a chip + word for everything else", () => {
    expect(kindLabel("CONCERT")).toBeNull();
    expect(kindLabel("EXHIBITION")).toEqual({ chip: "EXPO", word: "Exhibition" });
    expect(kindLabel("OTHER")).toEqual({ chip: "EVENT", word: "Not a concert" });
  });
});

describe("contextLine", () => {
  const lotd = programmeCopy("lotd26");
  const lgw = programmeCopy("lgw26");

  it("is null for a plain main-programme concert", () => {
    expect(contextLine({ series: null, host: null, kind: "CONCERT" }, lotd)).toBeNull();
    expect(contextLine({ series: null, host: null, kind: "CONCERT" }, lgw)).toBeNull();
  });

  it("keeps LOTD's TOUO wording exactly", () => {
    expect(contextLine({ series: "The Official Unofficial", host: "Opposite", kind: "CONCERT" }, lotd)).toBe(
      "The Official Unofficial · hosted by Opposite · free entry",
    );
  });

  it("adds the side note only to side-programme sets", () => {
    expect(contextLine({ series: null, host: "Opposite", kind: "CONCERT" }, lotd)).toBe("hosted by Opposite");
  });

  it("puts the kind first and uses LGW's unprefixed credit", () => {
    expect(contextLine({ series: "U?", host: "Curated by Jô Páscoa", kind: "OTHER" }, lgw)).toBe(
      "Not a concert · U? · Curated by Jô Páscoa",
    );
    expect(contextLine({ series: null, host: null, kind: "FILM" }, lgw)).toBe("Film");
  });
});

describe("programmeCopy", () => {
  it("falls back to neutral defaults for a festival with no copy", () => {
    expect(programmeCopy("pdc26")).toEqual(DEFAULT_PROGRAMME_COPY);
  });

  it("starts LGW's switches off and measures from TivoliVredenburg", () => {
    const lgw = programmeCopy("lgw26");
    expect(lgw.side.defaultShown).toBe(false);
    expect(lgw.nonConcertsDefaultShown).toBe(false);
    expect(lgw.hubName).toBe("TivoliVredenburg");
  });

  it("keeps LOTD's side programme shown by default", () => {
    expect(programmeCopy("lotd26").side).toMatchObject({ chip: "FREE", defaultShown: true });
  });
});

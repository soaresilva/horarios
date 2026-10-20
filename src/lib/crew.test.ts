import { describe, expect, it } from "vitest";
import {
  CREW_CODE_ALPHABET,
  CREW_COLORS,
  CREW_MAX_MEMBERS,
  crewAriaLabel,
  crewColor,
  crewErrorMessage,
  crewTooltip,
  formatCrewCode,
  friendsByPerformance,
  generateCrewCode,
  nextColorIndex,
  normalizeCrewCode,
  parseTag,
  toCrewDTO,
  type CrewFavoriteRow,
  type CrewMemberRow,
} from "./crew";

describe("crew codes", () => {
  it("generates 6 characters from the unambiguous alphabet only", () => {
    let n = 0;
    const code = generateCrewCode((max) => n++ % max);
    expect(code).toHaveLength(6);
    expect(code).toBe("ABCDEF");
    expect(generateCrewCode((max) => max - 1)).toBe("999999");
  });

  it("never contains a character people misread (0/O, 1/I/L)", () => {
    for (const c of "01OIL") expect(CREW_CODE_ALPHABET).not.toContain(c);
  });

  it.each([
    ["KX7PQ2", "KX7PQ2"],
    ["kx7-pq2", "KX7PQ2"],
    [" KX7 PQ2 ", "KX7PQ2"],
    ["kx7pq2", "KX7PQ2"],
  ])("normalises %j to %j", (input, expected) => {
    expect(normalizeCrewCode(input)).toBe(expected);
  });

  it.each(["", "KX7PQ", "KX7PQ22", "KX7PQ0", "KX7-PQO", "KX7PQ!", "ÀX7PQ2"])("rejects %j", (input) => {
    expect(normalizeCrewCode(input)).toBeNull();
  });

  it("formats with a dash and round-trips through normalise", () => {
    expect(formatCrewCode("KX7PQ2")).toBe("KX7-PQ2");
    expect(normalizeCrewCode(formatCrewCode("KX7PQ2"))).toBe("KX7PQ2");
  });
});

describe("parseTag", () => {
  it.each([
    ["D", "D", "D"],
    ["Zs", "Zs", "ZS"],
    [" m ", "m", "M"],
    ["Zé", "Zé", "ZÉ"],
    ["J2", "J2", "J2"],
    ["7", "7", "7"],
  ])("accepts %j as tag %j (key %j)", (input, tag, tagKey) => {
    expect(parseTag(input)).toEqual({ tag, tagKey });
  });

  it("counts a decomposed accent as one character", () => {
    expect(parseTag("Zé")).toEqual({ tag: "Zé", tagKey: "ZÉ" });
  });

  // "ßa" upper-cases to "SSA", three characters, which wouldn't fit the key column.
  it.each(["", "  ", "ABC", "D!", "🎸", "a-", "ßa"])("rejects %j", (input) => {
    expect(parseTag(input)).toBeNull();
  });
});

describe("colours", () => {
  it("has exactly one colour per seat, none of them the two mark colours", () => {
    expect(CREW_COLORS).toHaveLength(CREW_MAX_MEMBERS);
    expect(new Set(CREW_COLORS).size).toBe(CREW_MAX_MEMBERS);
    expect(CREW_COLORS).not.toContain("#3eb7fc");
    expect(CREW_COLORS).not.toContain("#f59e0b");
  });

  it("hands out the lowest free seat, and none when the crew is full", () => {
    expect(nextColorIndex([])).toBe(0);
    expect(nextColorIndex([0, 1, 3])).toBe(2);
    expect(nextColorIndex([1])).toBe(0);
    expect(nextColorIndex([0, 1, 2, 3, 4, 5, 6, 7])).toBeNull();
  });

  it("never throws on an out-of-range index", () => {
    expect(crewColor(8)).toBe(CREW_COLORS[0]);
    expect(crewColor(-1)).toBe(CREW_COLORS[7]);
  });
});

describe("toCrewDTO", () => {
  const members: CrewMemberRow[] = [
    { visitorId: "visitor-me-secret", tag: "D", colorIndex: 0, shareNotes: true },
    { visitorId: "visitor-zs-secret", tag: "Zs", colorIndex: 2, shareNotes: false },
    { visitorId: "visitor-m-secret", tag: "M", colorIndex: 1, shareNotes: true },
  ];
  const favorites: CrewFavoriteRow[] = [
    { visitorId: "visitor-m-secret", performanceId: "p1", tier: "MUST_SEE", note: "meet by the sound desk" },
    { visitorId: "visitor-m-secret", performanceId: "p2", tier: "INTERESTED", note: null },
    { visitorId: "visitor-m-secret", performanceId: "p3", tier: null, note: "scratch note on an unmarked set" },
    { visitorId: "visitor-zs-secret", performanceId: "p1", tier: "INTERESTED", note: "private thought" },
    { visitorId: "visitor-me-secret", performanceId: "p1", tier: "MUST_SEE", note: "my own" },
  ];

  it("never puts a visitorId anywhere in what goes to the browser", () => {
    const dto = toCrewDTO("KX7PQ2", members, favorites, "visitor-me-secret");
    const json = JSON.stringify(dto);
    expect(json).not.toContain("visitor-");
    expect(json).not.toContain("visitorId");
  });

  it("returns the caller's own seat as `me`, and only the others as members, in seat order", () => {
    const dto = toCrewDTO("KX7PQ2", members, favorites, "visitor-me-secret")!;
    expect(dto.code).toBe("KX7PQ2");
    expect(dto.me).toEqual({ tag: "D", colorIndex: 0, shareNotes: true });
    expect(dto.members.map((m) => m.tag)).toEqual(["M", "Zs"]);
  });

  it("maps tiers, keeps shared notes, drops notes of members who turned sharing off", () => {
    const dto = toCrewDTO("KX7PQ2", members, favorites, "visitor-me-secret")!;
    const m = dto.members.find((x) => x.tag === "M")!;
    const zs = dto.members.find((x) => x.tag === "Zs")!;
    expect(m.marks).toEqual({ p1: { tier: "must", note: "meet by the sound desk" }, p2: { tier: "interested" } });
    expect(zs.marks).toEqual({ p1: { tier: "interested" } });
    expect(JSON.stringify(dto)).not.toContain("private thought");
  });

  it("leaves out notes on sets the friend didn't mark", () => {
    const dto = toCrewDTO("KX7PQ2", members, favorites, "visitor-me-secret")!;
    expect(JSON.stringify(dto)).not.toContain("scratch note");
  });

  it("returns null for someone who isn't a member", () => {
    expect(toCrewDTO("KX7PQ2", members, favorites, "a-stranger")).toBeNull();
  });
});

describe("friendsByPerformance", () => {
  it("groups by set, must-see first, then by seat", () => {
    const map = friendsByPerformance([
      { tag: "M", colorIndex: 1, marks: { p1: { tier: "interested" }, p2: { tier: "must" } } },
      { tag: "Zs", colorIndex: 2, marks: { p1: { tier: "must", note: "front left" } } },
      { tag: "J", colorIndex: 3, marks: { p1: { tier: "must" } } },
      { tag: "A", colorIndex: 0, marks: { p1: { tier: "interested" } } },
    ]);
    expect(map.get("p1")!.map((f) => f.tag)).toEqual(["Zs", "J", "A", "M"]);
    expect(map.get("p1")![0]).toEqual({ tag: "Zs", colorIndex: 2, tier: "must", note: "front left" });
    expect(map.get("p2")).toEqual([{ tag: "M", colorIndex: 1, tier: "must" }]);
    expect(map.get("p3")).toBeUndefined();
  });
});

describe("wording", () => {
  const friends = [
    { tag: "D", colorIndex: 0, tier: "must" as const, note: "front left, get there early" },
    { tag: "Zs", colorIndex: 2, tier: "interested" as const },
  ];

  it("builds one hover line per friend with their note", () => {
    expect(crewTooltip(friends)).toBe("D: must-see · front left, get there early\nZs: interested");
  });

  it("builds a screen-reader label", () => {
    expect(crewAriaLabel(friends)).toBe("Crew: D must-see, Zs interested");
  });

  it("names the taken tag", () => {
    expect(crewErrorMessage("tag-taken", "Zs")).toBe("Zs is taken in this crew, pick another tag.");
    expect(crewErrorMessage("full")).toContain("8");
  });
});

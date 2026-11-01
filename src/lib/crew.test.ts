import { describe, expect, it } from "vitest";
import {
  blockBubbleMax,
  CREW_CODE_ALPHABET,
  CREW_COLORS,
  CREW_MAX_MEMBERS,
  CREW_MAX_PER_VISITOR,
  crewAriaLabel,
  crewColor,
  crewErrorMessage,
  crewLabel,
  crewTooltip,
  formatCrewCode,
  friendsByPerformance,
  generateCrewCode,
  nextColorIndex,
  normalizeCrewCode,
  parseCrewName,
  parseTag,
  toCrewsDTO,
  type CrewFavoriteRow,
  type CrewMemberRow,
  type CrewRow,
} from "./crew";
import type { FriendDTO } from "@/types/crew";

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
    expect(CREW_MAX_MEMBERS).toBe(15);
    expect(new Set(CREW_COLORS).size).toBe(CREW_MAX_MEMBERS);
    expect(CREW_COLORS).not.toContain("#3eb7fc");
    expect(CREW_COLORS).not.toContain("#f59e0b");
  });

  // CrewMember.colorIndex is stored: reordering would recolour everyone.
  it("keeps the original eight colours in their original seats", () => {
    expect(CREW_COLORS.slice(0, 8)).toEqual([
      "#fb7185",
      "#34d399",
      "#a78bfa",
      "#bef264",
      "#f0abfc",
      "#e7e5e4",
      "#5eead4",
      "#818cf8",
    ]);
  });

  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Each colour does two jobs: outlined bubbles use it as text on the page
  // background, filled bubbles put that same dark background on it as text.
  it.each(CREW_COLORS)("%s is readable against the page background, both ways round", (color) => {
    const contrast = (luminance(color) + 0.05) / (luminance("#0b1012") + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  it("hands out the lowest free seat, and none when the crew is full", () => {
    expect(nextColorIndex([])).toBe(0);
    expect(nextColorIndex([0, 1, 3])).toBe(2);
    expect(nextColorIndex([1])).toBe(0);
    expect(nextColorIndex([0, 1, 2, 3, 4, 5, 6, 7])).toBe(8);
    expect(nextColorIndex(Array.from({ length: 15 }, (_, i) => i))).toBeNull();
  });

  it("never throws on an out-of-range index", () => {
    expect(crewColor(15)).toBe(CREW_COLORS[0]);
    expect(crewColor(-1)).toBe(CREW_COLORS[14]);
  });
});

describe("parseCrewName", () => {
  it.each([
    ["LGW gang", "LGW gang"],
    ["  LGW   gang  ", "LGW gang"],
    ["tab\tand\nnewline", "tab and newline"],
    ["a\u0000b", "a b"],
    ["Coração", "Coração"],
  ])("tidies %j to %j", (input, expected) => {
    expect(parseCrewName(input)).toBe(expected);
  });

  it.each(["", "   ", "\n\t"])("clears the name for %j", (input) => {
    expect(parseCrewName(input)).toBeNull();
  });

  it("clamps to 20 characters without cutting an emoji in half", () => {
    expect(parseCrewName("x".repeat(25))).toBe("x".repeat(20));
    const name = parseCrewName(`${"x".repeat(19)}🎸🎸`)!;
    expect(Array.from(name)).toHaveLength(20);
    expect(name.endsWith("🎸")).toBe(true);
  });

  it("labels a crew by its name, or its code without one", () => {
    expect(crewLabel({ name: "LGW gang", code: "KX7PQ2" })).toBe("LGW gang");
    expect(crewLabel({ name: null, code: "KX7PQ2" })).toBe("KX7-PQ2");
  });
});

describe("toCrewsDTO", () => {
  const seat = (visitorId: string, tag: string, colorIndex: number, shareNotes = true): CrewMemberRow => ({
    id: `seat-${tag}-${colorIndex}`,
    visitorId,
    tag,
    colorIndex,
    shareNotes,
  });
  const crew = (id: string, members: CrewMemberRow[], name: string | null = null): CrewRow => ({
    id,
    code: id.toUpperCase().padEnd(6, "2"),
    name,
    members,
  });

  const members = [
    seat("visitor-me-secret", "D", 0),
    seat("visitor-zs-secret", "Zs", 2, false),
    seat("visitor-m-secret", "M", 1),
  ];
  const favorites: CrewFavoriteRow[] = [
    { visitorId: "visitor-m-secret", performanceId: "p1", tier: "MUST_SEE", note: "meet by the sound desk" },
    { visitorId: "visitor-m-secret", performanceId: "p2", tier: "INTERESTED", note: null },
    { visitorId: "visitor-m-secret", performanceId: "p3", tier: null, note: "scratch note on an unmarked set" },
    { visitorId: "visitor-zs-secret", performanceId: "p1", tier: "INTERESTED", note: "private thought" },
    { visitorId: "visitor-me-secret", performanceId: "p1", tier: "MUST_SEE", note: "my own" },
  ];

  it("never puts a visitorId anywhere in what goes to the browser", () => {
    const json = JSON.stringify(toCrewsDTO([crew("a", members)], favorites, "visitor-me-secret"));
    expect(json).not.toContain("visitor-");
    expect(json).not.toContain("visitorId");
  });

  it("returns the caller's own seat as `me`, and only the others as members, in seat order", () => {
    const dto = toCrewsDTO([crew("a", members, "LGW gang")], favorites, "visitor-me-secret");
    expect(dto.crews).toHaveLength(1);
    expect(dto.crews[0].name).toBe("LGW gang");
    expect(dto.crews[0].me).toEqual({ tag: "D", colorIndex: 0, shareNotes: true });
    expect(dto.crews[0].members.map((m) => m.tag)).toEqual(["M", "Zs"]);
    expect(dto.friends.map((f) => f.tag)).toEqual(["M", "Zs"]);
  });

  it("maps tiers, keeps shared notes, drops notes of members who turned sharing off", () => {
    const dto = toCrewsDTO([crew("a", members)], favorites, "visitor-me-secret");
    const m = dto.friends.find((x) => x.tag === "M")!;
    const zs = dto.friends.find((x) => x.tag === "Zs")!;
    expect(m.marks).toEqual({ p1: { tier: "must", note: "meet by the sound desk" }, p2: { tier: "interested" } });
    expect(zs.marks).toEqual({ p1: { tier: "interested" } });
    expect(JSON.stringify(dto)).not.toContain("private thought");
  });

  it("leaves out notes on sets the friend didn't mark", () => {
    expect(JSON.stringify(toCrewsDTO([crew("a", members)], favorites, "visitor-me-secret"))).not.toContain("scratch note");
  });

  it("returns no crews for someone who isn't a member", () => {
    expect(toCrewsDTO([crew("a", members)], favorites, "a-stranger")).toEqual({ crews: [], friends: [] });
  });

  describe("across several crews", () => {
    it("makes one friend of someone you share two crews with, carrying both crews, tag from the first", () => {
      const dto = toCrewsDTO(
        [
          crew("x", [seat("me", "D", 0), seat("both", "Bo", 3)]),
          crew("y", [seat("me", "Di", 1), seat("both", "B", 0)]),
        ],
        [{ visitorId: "both", performanceId: "p1", tier: "MUST_SEE", note: null }],
        "me",
      );
      expect(dto.friends).toHaveLength(1);
      expect(dto.friends[0]).toMatchObject({ tag: "Bo", colorIndex: 3, crewIds: ["x", "y"], marks: { p1: { tier: "must" } } });
      expect(dto.crews.map((c) => c.me.tag)).toEqual(["D", "Di"]);
      expect(dto.crews[1].members).toEqual([{ tag: "B", colorIndex: 0 }]);
    });

    it("never lists you as your own friend in any crew", () => {
      const dto = toCrewsDTO([crew("x", [seat("me", "D", 0)]), crew("y", [seat("me", "D", 1)])], [], "me");
      expect(dto.friends).toEqual([]);
    });

    it("includes a note when the friend shares notes in any crew you're both in", () => {
      const note = [{ visitorId: "both", performanceId: "p1", tier: "MUST_SEE" as const, note: "by the desk" }];
      const dto = toCrewsDTO(
        [
          crew("x", [seat("me", "D", 0), seat("both", "B", 1, false)]),
          crew("y", [seat("me", "D", 0), seat("both", "B", 1, true)]),
        ],
        note,
        "me",
      );
      expect(dto.friends[0].marks.p1.note).toBe("by the desk");
    });

    it("moves the later of two different people with the same tag and colour", () => {
      const dto = toCrewsDTO(
        [
          crew("x", [seat("me", "A", 1), seat("first-d", "D", 0)]),
          crew("y", [seat("me", "A", 1), seat("second-d", "d", 0), seat("third-d", "D", 2)]),
        ],
        [],
        "me",
      );
      expect(dto.friends.map((f) => [f.tag, f.colorIndex])).toEqual([
        ["D", 0],
        ["d", 1],
        ["D", 2],
      ]);
    });
  });
});

describe("friendsByPerformance", () => {
  const friend = (id: string, colorIndex: number, crewIds: string[], marks: FriendDTO["marks"]): FriendDTO => ({
    id,
    tag: id,
    colorIndex,
    crewIds,
    marks,
  });

  it("groups by set, must-see first, then by seat", () => {
    const map = friendsByPerformance([
      friend("M", 1, ["x"], { p1: { tier: "interested" }, p2: { tier: "must" } }),
      friend("Zs", 2, ["x"], { p1: { tier: "must", note: "front left" } }),
      friend("J", 3, ["x"], { p1: { tier: "must" } }),
      friend("A", 0, ["x"], { p1: { tier: "interested" } }),
    ]);
    expect(map.get("p1")!.map((f) => f.tag)).toEqual(["Zs", "J", "A", "M"]);
    expect(map.get("p1")![0]).toEqual({ id: "Zs", tag: "Zs", colorIndex: 2, crewIds: ["x"], tier: "must", note: "front left" });
    expect(map.get("p2")).toEqual([{ id: "M", tag: "M", colorIndex: 1, crewIds: ["x"], tier: "must" }]);
    expect(map.get("p3")).toBeUndefined();
  });

  it("drops a hidden crew's people, but keeps anyone also in a crew still showing", () => {
    const friends = [
      friend("OnlyX", 0, ["x"], { p1: { tier: "must" } }),
      friend("OnlyY", 1, ["y"], { p1: { tier: "must" } }),
      friend("Both", 2, ["x", "y"], { p1: { tier: "must" } }),
    ];
    expect(friendsByPerformance(friends, new Set(["y"])).get("p1")!.map((f) => f.tag)).toEqual(["OnlyX", "Both"]);
    expect(friendsByPerformance(friends, new Set(["x", "y"])).get("p1")).toBeUndefined();
  });
});

describe("blockBubbleMax", () => {
  it.each([
    [90, 1, 1],
    [90, 2, 0],
    [90, 14, 0],
    [120, 1, 1],
    [120, 3, 0],
    [124, 2, 0],
    [125, 1, 2],
    [125, 3, 2],
    [135, 14, 2],
    [200, 14, 2],
  ])("a %ipx block with %i friends shows %i bubbles", (extent, friends, expected) => {
    expect(blockBubbleMax(extent, friends)).toBe(expected);
  });
});

describe("wording", () => {
  const friends = [
    { id: "1", tag: "D", colorIndex: 0, crewIds: ["x"], tier: "must" as const, note: "front left, get there early" },
    { id: "2", tag: "Zs", colorIndex: 2, crewIds: ["x"], tier: "interested" as const },
  ];

  it("builds one hover line per friend with their note", () => {
    expect(crewTooltip(friends)).toBe("D: must-see · front left, get there early\nZs: interested");
  });

  it("builds a screen-reader label", () => {
    expect(crewAriaLabel(friends)).toBe("Crew: D must-see, Zs interested");
  });

  it("names the taken tag", () => {
    expect(crewErrorMessage("tag-taken", "Zs")).toBe("Zs is taken in this crew, pick another tag.");
    expect(crewErrorMessage("full")).toBe("That crew is full (15 people).");
    expect(crewErrorMessage("too-many-crews")).toContain(String(CREW_MAX_PER_VISITOR));
  });
});

// Pure crew logic: codes, tags, colours, and the one function that turns
// database rows into what a crewmate's browser is allowed to see. No Prisma
// or Node imports, so the client bundle can use the formatting helpers and
// every rule here is unit-testable without a database.

import type { CrewDTO, CrewError, CrewsDTO, CrewTier, FriendDTO } from "@/types/crew";

/** Seats in one crew; also the number of distinct colours. */
export const CREW_MAX_MEMBERS = 15;

/**
 * Crews one visitor can be in. Bounds what every poll fetches: 5 crews of 15
 * is 70 friends' marks for the festival, on festival-grounds signal.
 */
export const CREW_MAX_PER_VISITOR = 5;

export const CREW_NAME_MAX_LENGTH = 20;

// One colour per seat, picked to stay clear of the two colours that already
// mean something on a block: accent blue (#3eb7fc, your must-see) and amber
// (#f59e0b, your interested). All are light enough for dark text when filled
// and readable as text on the page background. Order matters twice: the first
// few are the most distinct, since most crews are small, and a stored
// CrewMember.colorIndex points in here, so append and never reorder.
export const CREW_COLORS = [
  "#fb7185", // rose
  "#34d399", // emerald
  "#a78bfa", // violet
  "#bef264", // lime
  "#f0abfc", // fuchsia
  "#e7e5e4", // stone
  "#5eead4", // teal
  "#818cf8", // indigo
  "#d946ef", // magenta
  "#b08968", // brown
  "#a3a34a", // olive
  "#fef08a", // yellow
  "#8fb996", // sage
  "#65a30d", // green
  "#94a3b8", // slate
] as const;

export function crewColor(colorIndex: number): string {
  return CREW_COLORS[((colorIndex % CREW_COLORS.length) + CREW_COLORS.length) % CREW_COLORS.length];
}

// No 0/O, 1/I/L: the code gets read aloud and retyped from a group chat.
// 31^6 is about 887 million codes.
export const CREW_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CREW_CODE_LENGTH = 6;
const CREW_CODE_PATTERN = new RegExp(`^[${CREW_CODE_ALPHABET}]{${CREW_CODE_LENGTH}}$`);

/** `random(max)` returns an integer in [0, max); the Server Action passes node:crypto's randomInt. */
export function generateCrewCode(random: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < CREW_CODE_LENGTH; i++) code += CREW_CODE_ALPHABET[random(CREW_CODE_ALPHABET.length)];
  return code;
}

/** "kx7-pq2" / " KX7 PQ2 " → "KX7PQ2"; null when it can't be a crew code at all. */
export function normalizeCrewCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return CREW_CODE_PATTERN.test(code) ? code : null;
}

/** "KX7PQ2" → "KX7-PQ2", the way people see and share it. */
export function formatCrewCode(code: string): string {
  return code.length === CREW_CODE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

// One or two letters or digits in any script ("D", "Zs", "Zé", "J2"). NFC
// first so a decomposed "é" (e + combining accent, two code points) counts
// as the one character a person typed. The upper-cased key has to fit too:
// "ß" upper-cases to "SS", so "ßa" would need three characters.
const TAG_PATTERN = /^[\p{L}\p{N}]{1,2}$/u;

export function parseTag(input: string): { tag: string; tagKey: string } | null {
  const tag = input.trim().normalize("NFC");
  if (!TAG_PATTERN.test(tag)) return null;
  const tagKey = tag.toUpperCase();
  if (Array.from(tagKey).length > 2) return null;
  return { tag, tagKey };
}

/** Lowest colour no current member holds, or null when the crew is full. */
export function nextColorIndex(taken: number[]): number | null {
  for (let i = 0; i < CREW_MAX_MEMBERS; i++) {
    if (!taken.includes(i)) return i;
  }
  return null;
}

/**
 * The shared name as stored: whitespace tidied, control characters gone,
 * clamped rather than rejected. Counted in code points, which is what the
 * VarChar(20) column counts, so an emoji can't be cut in half. Null when
 * nothing is left, which clears the name.
 */
export function parseCrewName(input: string): string | null {
  const name = input.normalize("NFC").replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  const clamped = Array.from(name).slice(0, CREW_NAME_MAX_LENGTH).join("").trim();
  return clamped === "" ? null : clamped;
}

/** What a crew is called on screen: its name, or its code. */
export function crewLabel(crew: { name: string | null; code: string }): string {
  return crew.name ?? formatCrewCode(crew.code);
}

export interface CrewMemberRow {
  id: string;
  visitorId: string;
  tag: string;
  colorIndex: number;
  shareNotes: boolean;
}

export interface CrewRow {
  id: string;
  code: string;
  name: string | null;
  members: CrewMemberRow[];
}

export interface CrewFavoriteRow {
  visitorId: string;
  performanceId: string;
  tier: "MUST_SEE" | "INTERESTED" | null;
  note: string | null;
}

// The only way crew data reaches a browser. `crews` is in the order the
// caller joined them. Four rules, all tested:
// 1. No visitorId, ever. It is the httpOnly cookie value (src/lib/visitor.ts)
//    and the whole credential: a crewmate holding it could become you.
// 2. Only sets with a tier. A note on an unmarked set is a scratch note, and
//    a bubble means "I'm going", which an unmarked set doesn't say.
// 3. A friend's note comes through if they share notes in any crew you're
//    both in, since that crew can already read it.
// 4. One person is one friend, however many crews you share with them. Their
//    tag and colour come from the first of those crews.
//
// Colours are per crew, so two different people can arrive with the same tag
// AND colour: founders always sit in seat 0, so two crews started by a "D"
// give two rose Ds. The later one moves to the next colour free for that tag.
export function toCrewsDTO(crews: CrewRow[], favorites: CrewFavoriteRow[], myVisitorId: string): CrewsDTO {
  const crewDTOs: CrewDTO[] = [];
  const friendsByVisitor = new Map<string, { friend: FriendDTO; shareNotes: boolean }>();
  const coloursByTag = new Map<string, number[]>();

  for (const crew of crews) {
    const me = crew.members.find((m) => m.visitorId === myVisitorId);
    if (!me) continue;

    const others = crew.members
      .filter((m) => m.visitorId !== myVisitorId)
      .sort((a, b) => a.colorIndex - b.colorIndex);

    crewDTOs.push({
      id: crew.id,
      code: crew.code,
      name: crew.name,
      me: { tag: me.tag, colorIndex: me.colorIndex, shareNotes: me.shareNotes },
      members: others.map((m) => ({ tag: m.tag, colorIndex: m.colorIndex })),
    });

    for (const member of others) {
      const known = friendsByVisitor.get(member.visitorId);
      if (known) {
        known.friend.crewIds.push(crew.id);
        known.shareNotes ||= member.shareNotes;
        continue;
      }
      const tagKey = member.tag.toUpperCase();
      const taken = coloursByTag.get(tagKey) ?? [];
      const colorIndex = taken.includes(member.colorIndex)
        ? (nextColorIndex(taken) ?? member.colorIndex)
        : member.colorIndex;
      coloursByTag.set(tagKey, [...taken, colorIndex]);
      friendsByVisitor.set(member.visitorId, {
        friend: { id: member.id, tag: member.tag, colorIndex, crewIds: [crew.id], marks: {} },
        shareNotes: member.shareNotes,
      });
    }
  }

  for (const row of favorites) {
    const entry = friendsByVisitor.get(row.visitorId);
    if (!entry || row.tier === null) continue;
    const tier: CrewTier = row.tier === "MUST_SEE" ? "must" : "interested";
    entry.friend.marks[row.performanceId] = entry.shareNotes && row.note ? { tier, note: row.note } : { tier };
  }

  return { crews: crewDTOs, friends: Array.from(friendsByVisitor.values(), (entry) => entry.friend) };
}

/** One friend's mark on one set, as every bubble, tooltip and sheet row reads it. */
export interface FriendMark {
  /** Stable per person: a tag is only unique inside one crew. */
  id: string;
  tag: string;
  colorIndex: number;
  crewIds: string[];
  tier: CrewTier;
  note?: string;
}

const NO_HIDDEN_CREWS: ReadonlySet<string> = new Set();

// Must-see before interested, then seat order, so the same friend sits in
// the same place on every block and the bubbles that survive a "+N" cut
// are the strongest picks. A crew switched off in the panel takes its people
// with it, except anyone you also share a crew that's still on with.
export function friendsByPerformance(
  friends: FriendDTO[],
  hiddenCrewIds: ReadonlySet<string> = NO_HIDDEN_CREWS,
): Map<string, FriendMark[]> {
  const byId = new Map<string, FriendMark[]>();
  for (const friend of friends) {
    if (friend.crewIds.every((id) => hiddenCrewIds.has(id))) continue;
    for (const [performanceId, mark] of Object.entries(friend.marks)) {
      const list = byId.get(performanceId) ?? [];
      list.push({
        id: friend.id,
        tag: friend.tag,
        colorIndex: friend.colorIndex,
        crewIds: friend.crewIds,
        tier: mark.tier,
        ...(mark.note ? { note: mark.note } : {}),
      });
      byId.set(performanceId, list);
    }
  }
  for (const list of byId.values()) {
    list.sort((a, b) => (a.tier === b.tier ? a.colorIndex - b.colorIndex : a.tier === "must" ? -1 : 1));
  }
  return byId;
}

// Bubbles a transposed block's clock line can hold while its time stays
// whole. The line loses 44px to padding and the star; the time is 27px, a
// bubble 16px, the "+N" about 13px, plus 2px gaps. Two bubbles and a "+N" need
// 122px of block. Below that, one friend still gets their bubble (45px of
// line, and LGW's 90px floor leaves 46px), but two or more collapse to a bare
// "+N": a bubble and a count would leave "1…" of the time. Tapping still
// opens the sheet with everyone in it.
export function blockBubbleMax(extent: number, friendCount: number): 0 | 1 | 2 {
  if (extent >= 125) return 2;
  return friendCount === 1 ? 1 : 0;
}

export function tierWord(tier: CrewTier): string {
  return tier === "must" ? "must-see" : "interested";
}

/** Hover text: one line per friend, "D: must-see · front left". */
export function crewTooltip(friends: FriendMark[]): string {
  return friends.map((f) => `${f.tag}: ${tierWord(f.tier)}${f.note ? ` · ${f.note}` : ""}`).join("\n");
}

/** "Crew: D must-see, M interested" for screen readers. */
export function crewAriaLabel(friends: FriendMark[]): string {
  return `Crew: ${friends.map((f) => `${f.tag} ${tierWord(f.tier)}`).join(", ")}`;
}

export function crewErrorMessage(error: CrewError, tag?: string): string {
  switch (error) {
    case "invalid":
      return "No crew with that code.";
    case "full":
      return `That crew is full (${CREW_MAX_MEMBERS} people).`;
    case "tag-taken":
      return tag ? `${tag} is taken in this crew, pick another tag.` : "That tag is taken in this crew.";
    case "bad-tag":
      return "Your tag must be 1 or 2 letters or digits.";
    case "too-many-crews":
      return `You're in ${CREW_MAX_PER_VISITOR} crews already. Leave one first.`;
    case "not-in-crew":
      return "You're not in a crew any more.";
    case "disabled":
      return "Crews aren't on for this festival.";
    case "try-again":
      return "Something went wrong, try again.";
  }
}

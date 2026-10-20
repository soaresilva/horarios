// Pure crew logic: codes, tags, colours, and the one function that turns
// database rows into what a crewmate's browser is allowed to see. No Prisma
// or Node imports, so the client bundle can use the formatting helpers and
// every rule here is unit-testable without a database.

import type { CrewDTO, CrewError, CrewMemberDTO, CrewTier } from "@/types/crew";

/** A crew is for a handful of friends; also the number of distinct colours. */
export const CREW_MAX_MEMBERS = 8;

// One colour per seat, picked to stay clear of the two colours that already
// mean something on a block: accent blue (#3eb7fc, your must-see) and amber
// (#f59e0b, your interested). The first few are the most distinct from each
// other, since most crews will be 2-4 people.
export const CREW_COLORS = [
  "#fb7185", // rose
  "#34d399", // emerald
  "#a78bfa", // violet
  "#bef264", // lime
  "#f0abfc", // fuchsia
  "#e7e5e4", // stone
  "#5eead4", // teal
  "#818cf8", // indigo
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

export interface CrewMemberRow {
  visitorId: string;
  tag: string;
  colorIndex: number;
  shareNotes: boolean;
}

export interface CrewFavoriteRow {
  visitorId: string;
  performanceId: string;
  tier: "MUST_SEE" | "INTERESTED" | null;
  note: string | null;
}

// The only way crew data reaches a browser. Three rules, all tested:
// 1. No visitorId, ever. It is the httpOnly cookie value (src/lib/visitor.ts)
//    and the whole credential: a crewmate holding it could become you.
// 2. Only sets with a tier. A note on an unmarked set is a scratch note, and
//    a bubble means "I'm going", which an unmarked set doesn't say.
// 3. A member with shareNotes off contributes tiers only.
export function toCrewDTO(
  code: string,
  members: CrewMemberRow[],
  favorites: CrewFavoriteRow[],
  myVisitorId: string,
): CrewDTO | null {
  const me = members.find((m) => m.visitorId === myVisitorId);
  if (!me) return null;

  const others: CrewMemberDTO[] = members
    .filter((m) => m.visitorId !== myVisitorId)
    .sort((a, b) => a.colorIndex - b.colorIndex)
    .map((member) => {
      const marks: CrewMemberDTO["marks"] = {};
      for (const row of favorites) {
        if (row.visitorId !== member.visitorId || row.tier === null) continue;
        const tier: CrewTier = row.tier === "MUST_SEE" ? "must" : "interested";
        marks[row.performanceId] = member.shareNotes && row.note ? { tier, note: row.note } : { tier };
      }
      return { tag: member.tag, colorIndex: member.colorIndex, marks };
    });

  return {
    code,
    me: { tag: me.tag, colorIndex: me.colorIndex, shareNotes: me.shareNotes },
    members: others,
  };
}

/** One friend's mark on one set, as every bubble, tooltip and sheet row reads it. */
export interface FriendMark {
  tag: string;
  colorIndex: number;
  tier: CrewTier;
  note?: string;
}

// Must-see before interested, then seat order, so the same friend sits in
// the same place on every block and the bubbles that survive a "+N" cut
// are the strongest picks.
export function friendsByPerformance(members: CrewMemberDTO[]): Map<string, FriendMark[]> {
  const byId = new Map<string, FriendMark[]>();
  for (const member of members) {
    for (const [performanceId, mark] of Object.entries(member.marks)) {
      const list = byId.get(performanceId) ?? [];
      list.push({ tag: member.tag, colorIndex: member.colorIndex, tier: mark.tier, ...(mark.note ? { note: mark.note } : {}) });
      byId.set(performanceId, list);
    }
  }
  for (const list of byId.values()) {
    list.sort((a, b) => (a.tier === b.tier ? a.colorIndex - b.colorIndex : a.tier === "must" ? -1 : 1));
  }
  return byId;
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
    case "already-in-crew":
      return "You're already in a crew. Leave it first.";
    case "not-in-crew":
      return "You're not in a crew any more.";
    case "disabled":
      return "Crews aren't on for this festival.";
    case "try-again":
      return "Something went wrong, try again.";
  }
}

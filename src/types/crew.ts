// Wire format for the crew Server Actions (src/app/crew/actions.ts). Built
// only by toCrewsDTO in src/lib/crew.ts, which is where the "a visitorId
// never crosses this boundary" rule is enforced and tested.

export type CrewTier = "must" | "interested";

export interface CrewMarkDTO {
  tier: CrewTier;
  /** Absent when the friend has no note on the set or isn't sharing notes with you. */
  note?: string;
}

/** Someone else's seat in one crew, for the panel's list of who's in it. */
export interface CrewMemberDTO {
  tag: string;
  colorIndex: number;
}

export interface CrewDTO {
  id: string;
  /** Normalised, no dash ("KX7PQ2"); formatCrewCode adds it for display. */
  code: string;
  /** Shared and optional; crewLabel falls back to the code. */
  name: string | null;
  me: { tag: string; colorIndex: number; shareNotes: boolean };
  /** Everyone else in the crew, by colorIndex. Never includes the caller. */
  members: CrewMemberDTO[];
}

/**
 * One person, however many of your crews you share with them. Deduped on the
 * server because the browser never sees the visitorId that would let it
 * tell two seats are the same person.
 */
export interface FriendDTO {
  /** Their first seat's row id: stable and opaque, not a credential. */
  id: string;
  tag: string;
  colorIndex: number;
  /** Every crew you share with them, in the order you joined those crews. */
  crewIds: string[];
  /** Marked sets in the requested festival, keyed by performance id. */
  marks: Record<string, CrewMarkDTO>;
}

export interface CrewsDTO {
  /** In the order you joined them. */
  crews: CrewDTO[];
  friends: FriendDTO[];
}

export type CrewError =
  | "disabled"
  | "invalid"
  | "full"
  | "tag-taken"
  | "bad-tag"
  | "too-many-crews"
  | "not-in-crew"
  | "try-again";

export type CrewResult = { crews: CrewsDTO } | { error: CrewError };

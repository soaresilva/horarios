// Wire format for the crew Server Actions (src/app/crew/actions.ts). Built
// only by toCrewDTO in src/lib/crew.ts, which is where the "a visitorId
// never crosses this boundary" rule is enforced and tested.

export type CrewTier = "must" | "interested";

export interface CrewMarkDTO {
  tier: CrewTier;
  /** Absent when the member has no note on the set or has note sharing off. */
  note?: string;
}

export interface CrewMemberDTO {
  tag: string;
  colorIndex: number;
  /** Marked sets in the requested festival, keyed by performance id. */
  marks: Record<string, CrewMarkDTO>;
}

export interface CrewDTO {
  /** Normalised, no dash ("KX7PQ2"); formatCrewCode adds it for display. */
  code: string;
  me: { tag: string; colorIndex: number; shareNotes: boolean };
  /** Everyone else in the crew, by colorIndex. Never includes the caller. */
  members: CrewMemberDTO[];
}

export type CrewError =
  | "disabled"
  | "invalid"
  | "full"
  | "tag-taken"
  | "bad-tag"
  | "already-in-crew"
  | "not-in-crew"
  | "try-again";

export type CrewResult = { crew: CrewDTO } | { error: CrewError };

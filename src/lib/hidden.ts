import type { MarkTier } from "@/hooks/useMarks";
import { actKeyOf, type ShowLike } from "@/lib/shows";

type ActLike = Pick<ShowLike, "id" | "artistId" | "artistName">;

/**
 * Act key for every performance id, built once per schedule load so blocks
 * can ask "is this set's act hidden?" without regrouping the festival on
 * every render.
 */
export function actKeysById(performances: ActLike[]): Map<string, string> {
  return new Map(performances.map((p) => [p.id, actKeyOf(p)]));
}

/** Every performance id belonging to the act, across the whole festival. */
export function idsOfAct(performances: ActLike[], actKey: string): string[] {
  return performances.filter((p) => actKeyOf(p) === actKey).map((p) => p.id);
}

/**
 * Whether a set stays on the grid. Hidden acts drop out unless the "show
 * hidden" switch is on, but a set that still carries a tier always stays:
 * a set you marked never silently vanishes. Hiding clears the act's tiers
 * (useMarks hideAct), so that exception only arises when a pairing merge
 * brings a mark from one device and a hide from another.
 */
export function isGridVisible({
  actHidden,
  tier,
  showHidden,
}: {
  actHidden: boolean;
  tier: MarkTier | null;
  showHidden: boolean;
}): boolean {
  return !actHidden || showHidden || tier !== null;
}

/**
 * How many hidden acts this festival actually has sets for. A hidden key can
 * outlive its act (an importer renamed or dropped it), and counting that one
 * would show a "hidden (1)" switch that reveals nothing.
 */
export function countHiddenActs(hidden: string[], actKeyById: Map<string, string>): number {
  const present = new Set(actKeyById.values());
  return new Set(hidden.filter((key) => present.has(key))).size;
}

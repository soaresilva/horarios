// What a set is and who put it on, as one line of text. Shared by the block
// tooltip and the mark sheet so the two can't word it differently.
import type { ProgrammeCopy } from "@/lib/festival-copy";
import type { PerformanceKindName } from "@/types/schedule";

export const KIND_LABELS: Record<Exclude<PerformanceKindName, "CONCERT">, { chip: string; word: string }> = {
  FILM: { chip: "FILM", word: "Film" },
  TALK: { chip: "TALK", word: "Talk" },
  WORKSHOP: { chip: "WORKSHOP", word: "Workshop" },
  EXHIBITION: { chip: "EXPO", word: "Exhibition" },
  OTHER: { chip: "EVENT", word: "Not a concert" },
};

export function kindLabel(kind: PerformanceKindName): { chip: string; word: string } | null {
  return kind === "CONCERT" ? null : KIND_LABELS[kind];
}

export interface ContextFields {
  series: string | null;
  host: string | null;
  kind: PerformanceKindName;
}

/**
 * "Exhibition · U? · Curated by Fai Aldhukair", "The Official Unofficial ·
 * hosted by Opposite · free entry", or null for a plain main-programme
 * concert with nobody credited.
 */
export function contextLine(p: ContextFields, copy: ProgrammeCopy): string | null {
  const host = p.host ? (copy.hostPrefix ? `${copy.hostPrefix} ${p.host}` : p.host) : null;
  const parts = [
    kindLabel(p.kind)?.word,
    p.series,
    host,
    p.series ? copy.side.note : undefined,
  ].filter((x): x is string => Boolean(x));
  return parts.length > 0 ? parts.join(" · ") : null;
}

import { parseCancellation, type ShowLike } from "@/lib/shows";

/**
 * Lowercased, trimmed, with accents stripped, so a visitor typing on a phone
 * keyboard finds "Bárbara" from "barbara" (and the other way round). NFD
 * splits "á" into "a" plus a combining mark; the marks are what's dropped.
 */
export function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/**
 * Every set whose act name contains every word of `query`, chronologically.
 *
 * Takes the whole festival's performances, not one day's: the point is to
 * answer "when do they play" without opening every day tab. Word-wise rather
 * than one substring, so "country road" finds "Black Country, New Road".
 * Matched against the display name, so typing "cancelled" doesn't list every
 * cancelled set. An empty or whitespace-only query matches nothing.
 */
export function searchPerformances<T extends ShowLike>(performances: T[], query: string): T[] {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return performances
    .filter((p) => {
      const name = foldForSearch(parseCancellation(p.artistName).displayName);
      return words.every((word) => name.includes(word));
    })
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

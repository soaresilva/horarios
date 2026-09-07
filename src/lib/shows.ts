export interface ShowLike {
  id: string;
  artistId: string | null;
  artistName: string;
  startTime: Date;
}

export interface ShowOrdinal {
  index: number;
  total: number;
}

/**
 * "Show 2 of 3" for every performance, keyed by performance id.
 *
 * Showcase festivals book most acts more than once across the week, and
 * Left of the Dial marks this on its own printed timetable with a `#`. It's
 * genuinely useful: seeing "#1/3" means missing this one isn't final.
 *
 * Derived rather than stored — it's a function of the schedule, so storing it
 * would just be a second copy to keep in sync with every importer run.
 * Grouped across the whole festival, not per day, since the point is exactly
 * that the other shows are on other days. Keyed on artistId where there is
 * one, falling back to a normalised name for festivals with no Artist rows,
 * so two different acts that happen to share a display name don't merge.
 */
export function showOrdinals(performances: ShowLike[]): Map<string, ShowOrdinal> {
  const groups = new Map<string, ShowLike[]>();
  for (const performance of performances) {
    const key = performance.artistId ?? `name:${performance.artistName.trim().toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.push(performance);
    else groups.set(key, [performance]);
  }

  const ordinals = new Map<string, ShowOrdinal>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    sorted.forEach((performance, i) => {
      ordinals.set(performance.id, { index: i + 1, total: sorted.length });
    });
  }
  return ordinals;
}

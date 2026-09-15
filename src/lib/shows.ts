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

// Groups a performance with the other sets by the same act. Artist id where
// there is one (Left of the Dial has Artist rows), falling back to a
// normalised display name for festivals that don't (Paredes de Coura), so
// two different acts sharing a display name don't merge into one.
function artistKey(performance: ShowLike): string {
  return performance.artistId ?? `name:${performance.artistName.trim().toLowerCase()}`;
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
    const key = artistKey(performance);
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

/**
 * The act's *other* sets, chronologically, for the performance with the given
 * id — what MarkSheet shows as "Also plays:", so deciding to skip a clashing
 * set is a decision made with the alternatives in front of you rather than
 * from the `#2/3` marker alone.
 *
 * Takes the whole festival's performances, not one day's: the entire point is
 * that the other shows are usually on other days. Returns `[]` for an act
 * playing once, and for an id that isn't in the list at all (a set deleted
 * server-side while the sheet is open), which is exactly what should render.
 */
export function otherShowsOf<T extends ShowLike>(performances: T[], performanceId: string): T[] {
  const self = performances.find((p) => p.id === performanceId);
  if (!self) return [];
  const key = artistKey(self);
  return performances
    .filter((p) => p.id !== performanceId && artistKey(p) === key)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

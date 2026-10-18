// Pure parsing for the Le Guess Who? importer: one Livewire timetable
// snapshot (scripts/lgw/livewire.ts) -> flat show rows. No I/O, so it is
// gate-tested against trimmed real snapshots in scripts/lgw/__fixtures__/.
//
// leguesswho.com/timetable is a Livewire component. Its state ships as JSON
// in which every PHP array is "dehydrated" to a `[value, {"s":"arr"}]` pair,
// recursively. `hydrate` undoes that once, so the rest of this file reads
// plain objects.

export type Programme = "LGW" | "U?";

/** One timetabled item exactly as the source states it, before any planning. */
export interface RawShow {
  programme: Programme;
  /** The site's day tab (YYYY-MM-DD) this show is listed under. */
  day: string;
  showId: number;
  name: string;
  venue: string;
  /** Room inside the venue ("Ronda"), or null for a one-room venue. */
  room: string | null;
  /** The source's own stage id. Not unique across venues' rooms in U?, kept for debugging only. */
  sourceStageId: number;
  /**
   * Hours after the site day's local midnight, as the source keys them:
   * 18.5 is 18:30, 25 is 01:00 the next morning, 30.5 is 06:30 the next
   * morning. This is what makes the overnight 24 HOUR DUB and WAS. sets
   * unambiguous; the clock strings alone are not.
   */
  start: number;
  end: number;
  /** The "HH:MM - HH:MM" label, kept so a disagreement with start/end is caught. */
  time: string;
  /** The source's short project label (" aja monet", "COSMOS", "Film"), trimmed. */
  project: string | null;
  /** Key into the snapshot's project list, which carries the full name ("Curated by aja monet"). */
  projectId: number | null;
  /** Lineup page slug, or null when the show has no page. Not unique per show: see plan.ts. */
  slug: string | null;
}

const isDehydratedArray = (x: unknown): x is [unknown, { s: "arr" }] =>
  Array.isArray(x) &&
  x.length === 2 &&
  typeof x[1] === "object" &&
  x[1] !== null &&
  (x[1] as { s?: unknown }).s === "arr";

/** Undo Livewire's `[value, {s:"arr"}]` wrapping, all the way down. */
export function hydrate(x: unknown): unknown {
  if (isDehydratedArray(x)) return hydrate(x[0]);
  if (Array.isArray(x)) return x.map(hydrate);
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, hydrate(v)]));
  }
  return x;
}

/** PHP lists with gaps or numeric keys arrive as objects; both mean "the values, in order". */
function valuesOf(x: unknown): unknown[] {
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object") return Object.values(x);
  return [];
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/**
 * `<span class="venue">TivoliVredenburg</span><span>Grote Zaal</span>` ->
 * venue + room. A one-room venue has only the first span.
 */
export function parseStageLabel(html: string): { venue: string; room: string | null } {
  const spans = [...html.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((m) => decodeEntities(m[1]).trim());
  const parts = spans.filter(Boolean);
  if (parts.length === 0) throw new Error(`Unreadable stage label: ${html}`);
  return { venue: parts[0], room: parts[1] ?? null };
}

/** Decimal hours -> "HH:MM" on a 24-hour clock (25.75 -> "01:45"). */
export function clockOf(hours: number): string {
  const minutes = Math.round(hours * 60);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function slugFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/lineup\/([^/?#]+)/);
  return match ? match[1] : null;
}

interface SourceShow {
  show_id: number;
  name: string;
  time: string;
  endTime: number;
  project?: string | null;
  project_id?: number | null;
  url?: string | null;
}

/**
 * Every show in one day's snapshot. Throws, rather than skipping, on
 * anything it can't read: a silently dropped set is worse than a failed
 * import, because nobody notices it's missing.
 */
export function parseTimetableData(data: unknown, programme: Programme, day: string): RawShow[] {
  const root = hydrate(data) as { day?: unknown };
  if (root?.day === undefined) throw new Error(`${programme} ${day}: snapshot has no "day" key; has the page changed?`);

  // `day` is one {stages, start} group; tolerate a list of them too.
  const groups = (root.day as { stages?: unknown }).stages !== undefined ? [root.day] : valuesOf(root.day);
  const shows: RawShow[] = [];
  for (const group of groups) {
    const stages = (group as { stages?: unknown }).stages;
    for (const rawStage of valuesOf(stages)) {
      const stage = rawStage as { stage?: string; stage_id?: number; shows?: unknown };
      if (typeof stage.stage !== "string" || typeof stage.stage_id !== "number") {
        throw new Error(`${programme} ${day}: stage without a label or id: ${JSON.stringify(stage).slice(0, 200)}`);
      }
      const { venue, room } = parseStageLabel(stage.stage);
      // `shows` is keyed by start hour: {"18.5": show, "25": show}. An
      // empty room arrives as []. One show per key; tolerate a list in case
      // the site ever stacks two in one slot, so neither is lost.
      const byStart = Array.isArray(stage.shows) ? {} : ((stage.shows ?? {}) as Record<string, unknown>);
      if (Array.isArray(stage.shows) && stage.shows.length > 0) {
        throw new Error(`${programme} ${day} ${venue}: shows is a non-empty list, expected a map keyed by start hour.`);
      }
      for (const [startKey, value] of Object.entries(byStart)) {
        for (const s of Array.isArray(value) ? value : [value]) {
          shows.push(toRawShow(s as SourceShow, startKey, { programme, day, venue, room, sourceStageId: stage.stage_id }));
        }
      }
    }
  }
  return shows;
}

function toRawShow(
  s: SourceShow,
  startKey: string,
  ctx: { programme: Programme; day: string; venue: string; room: string | null; sourceStageId: number },
): RawShow {
  const where = `${ctx.programme} ${ctx.day} ${ctx.venue}${ctx.room ? ` / ${ctx.room}` : ""}`;
  if (typeof s?.show_id !== "number" || typeof s.name !== "string" || typeof s.time !== "string") {
    throw new Error(`${where}: unreadable show ${JSON.stringify(s).slice(0, 200)}`);
  }
  const start = Number(startKey);
  const end = Number(s.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error(`${where}: "${s.name}" has start ${startKey} / end ${s.endTime}.`);
  }
  // The decimal keys are what instants are built from; the label is what a
  // visitor reads on leguesswho.com. If they ever disagree, stop.
  const label = `${clockOf(start)} - ${clockOf(end)}`;
  if (s.time.trim() !== label) {
    throw new Error(`${where}: "${s.name}" is labelled "${s.time}" but keyed ${start}-${end} (${label}).`);
  }
  const project = s.project?.trim() || null;
  return {
    ...ctx,
    showId: s.show_id,
    name: decodeEntities(s.name).trim(),
    start,
    end,
    time: s.time.trim(),
    project: project ? decodeEntities(project) : null,
    projectId: typeof s.project_id === "number" ? s.project_id : null,
    slug: slugFromUrl(s.url),
  };
}

/** The day tabs a snapshot offers, in order (`setDay` takes these ids). */
export function daysOf(data: unknown): string[] {
  const root = hydrate(data) as { days?: unknown };
  return valuesOf(root?.days).map((d) => {
    const id = (d as { id?: unknown }).id;
    if (typeof id !== "string" || !/^\d{4}-\d\d-\d\d$/.test(id)) throw new Error(`Unreadable day tab: ${JSON.stringify(d)}`);
    return id;
  });
}

export interface SourceProject {
  id: number;
  name: string;
}

/** The project filter list ("Curated by aja monet", "24 HOUR DUB", ...). Shows reference it by id. */
export function projectsOf(data: unknown): SourceProject[] {
  const root = hydrate(data) as { projects?: unknown };
  return valuesOf(root?.projects).map((p) => {
    const { id, name } = p as { id?: unknown; name?: unknown };
    if (typeof id !== "number" || typeof name !== "string") throw new Error(`Unreadable project: ${JSON.stringify(p)}`);
    return { id, name: decodeEntities(name).trim() };
  });
}

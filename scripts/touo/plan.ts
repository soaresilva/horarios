// Pure planning for the TOUO importer: snapshot rows -> performance rows,
// plus the checks that make a bad snapshot fail before it reaches a
// database. No Prisma, no I/O, so all of it is gate-tested.
import { fromFestivalDayTime, type FestivalTime } from "../../src/lib/time";
import { dateForDay } from "../lotd/venues";
import { touoStageSlug } from "./venues";

export const TOUO_SERIES = "The Official Unofficial";
export const TOUO_ID_PREFIX = "touo26-p-";
const FT: FestivalTime = { timezone: "Europe/Amsterdam", locale: "en-GB" };

export interface TouoSet {
  day: "FRIDAY" | "SATURDAY";
  venue: string;
  host: string | null;
  artist: string;
  pdfName: string;
  country: string | null;
  start: string;
  end: string;
  kind: "band" | "extra";
  note?: string;
}

export interface TouoSnapshot {
  source: string;
  fetchedAt: string;
  generatedBy: string;
  sets: TouoSet[];
}

export interface ArtistRef {
  id: string;
  name: string;
}

export interface PlannedTouo {
  id: string;
  artistName: string;
  artistId: string | null;
  stageSlug: string;
  date: string;
  startTime: Date;
  endTime: Date;
  host: string | null;
  series: string;
}

/**
 * Blocks per room per day as counted by eye on the PDF, independently of
 * the extractor. This is the integrity check: if a PDF revision moves or
 * drops a block, or the extractor misses one, this disagrees with the
 * snapshot and the import stops. Update it from the PDF, not from the
 * snapshot, or it checks nothing.
 */
export const EXPECTED_SETS_PER_ROOM: Record<string, number> = {
  "FRIDAY BREWPUB REIJNGOUD": 3,
  "FRIDAY PLATO": 4,
  "FRIDAY ROTOWN": 4, // 3 bands + Sticker Night
  "FRIDAY STALLES (FKA CENTRAAL)": 5,
  "FRIDAY TRAMHUIS": 2,
  "FRIDAY UNIEK": 4,
  "FRIDAY V11": 4,
  "SATURDAY ARMINIUS": 3,
  "SATURDAY BREWPUB REIJNGOUD": 5,
  "SATURDAY MONO": 3,
  "SATURDAY PLATO": 2,
  "SATURDAY ROTOWN": 4,
  "SATURDAY SALSABILITY": 3,
  "SATURDAY STALLES (FKA CENTRAAL)": 5,
  "SATURDAY TIME IS THE NEW SPACE": 4,
  "SATURDAY TR DOWN": 1,
  "SATURDAY TR FOYER": 1,
  "SATURDAY UNIEK": 3,
  "SATURDAY V11": 4,
  "SATURDAY ZONDEBOK EN ZWARTE SCHAAP": 3,
};
export const EXPECTED_BANDS = 64;
export const EXPECTED_EXTRAS = 3;

// Band sets sit inside the advertised daytime window. Extras are exempt:
// Sticker Night is the after-midnight party.
const BAND_WINDOW = { from: "11:45", to: "16:00" };

/** Name key for matching a PDF name to a LOTD Artist: case, accents and punctuation don't count. */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/gi, "o")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ø/gi, "o")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function planTouo(sets: TouoSet[], lotdArtists: ArtistRef[]): PlannedTouo[] {
  const artistByKey = new Map(lotdArtists.map((a) => [nameKey(a.name), a]));
  return sets.map((set) => {
    const date = dateForDay(set.day);
    const stageSlug = touoStageSlug(set.venue);
    const linked = set.kind === "band" ? artistByKey.get(nameKey(set.artist)) : undefined;
    return {
      // Same shape as lotd26-p-*: one act never plays the same room twice
      // on one day, so this is unique and stable across re-imports. A
      // separate prefix keeps the two importers' --prune from ever touching
      // each other's rows.
      id: `${TOUO_ID_PREFIX}${slugify(set.artist)}-${set.day.toLowerCase()}-${stageSlug}`,
      // A linked act shows under its LOTD name so the two programmes read
      // as the same band in the grid and the mark sheet.
      artistName: linked?.name ?? set.artist,
      artistId: linked?.id ?? null,
      stageSlug,
      date,
      startTime: fromFestivalDayTime(date, set.start, FT),
      endTime: fromFestivalDayTime(date, set.end, FT),
      host: set.host,
      series: TOUO_SERIES,
    };
  });
}

export interface Slot {
  id: string;
  label: string;
  stageKey: string;
  startTime: Date;
  endTime: Date;
}

/** Every pair of sets that share a room and overlap in time (touching end-to-start is fine). */
export function findOverlaps(slots: Slot[]): string[] {
  const byStage = new Map<string, Slot[]>();
  for (const s of slots) byStage.set(s.stageKey, [...(byStage.get(s.stageKey) ?? []), s]);
  const clashes: string[] = [];
  for (const [stage, list] of byStage) {
    const sorted = [...list].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.startTime < prev.endTime) {
        clashes.push(`${stage}: "${prev.label}" overlaps "${cur.label}"`);
      }
    }
  }
  return clashes;
}

export interface MainProgrammeCheck {
  clashes: string[];
  /** Main-programme sets whose estimated end must move back to a TOUO start. */
  clips: { id: string; label: string; endTime: Date }[];
}

/**
 * Check TOUO sets against the main programme in the same rooms.
 *
 * LOTD publishes only start times; its end times are a 40-minute estimate
 * clipped at the next set in the room (src/lib/lotd-endtimes.ts). So a LOTD
 * *start* inside a TOUO set is a real clash, but a LOTD *estimated end*
 * running past a TOUO start isn't: the same clipping rule applies, and the
 * LOTD set ends where the TOUO one begins. scripts/import-lotd.ts applies
 * that rule too (it treats TOUO starts as clip boundaries), so the two
 * importers agree instead of undoing each other.
 */
export function checkAgainstMainProgramme(main: Slot[], touo: Slot[]): MainProgrammeCheck {
  const clashes: string[] = [];
  const clips = new Map<string, { id: string; label: string; endTime: Date }>();
  for (const t of touo) {
    for (const m of main) {
      if (m.stageKey !== t.stageKey) continue;
      if (m.startTime >= t.startTime && m.startTime < t.endTime) {
        clashes.push(`${t.stageKey}: "${m.label}" starts during "${t.label}"`);
      } else if (m.startTime < t.startTime && m.endTime > t.startTime) {
        const earlier = clips.get(m.id);
        if (!earlier || t.startTime < earlier.endTime) clips.set(m.id, { id: m.id, label: m.label, endTime: t.startTime });
      }
    }
  }
  return { clashes, clips: [...clips.values()] };
}

/** Everything wrong with a snapshot, as human-readable lines. Empty means safe to apply. */
export function validateTouoSnapshot(sets: TouoSet[]): string[] {
  const errors: string[] = [];

  const bands = sets.filter((s) => s.kind === "band").length;
  const extras = sets.filter((s) => s.kind === "extra").length;
  if (bands !== EXPECTED_BANDS) errors.push(`Expected ${EXPECTED_BANDS} band sets, snapshot has ${bands}.`);
  if (extras !== EXPECTED_EXTRAS) errors.push(`Expected ${EXPECTED_EXTRAS} extras, snapshot has ${extras}.`);

  const perRoom = new Map<string, number>();
  for (const s of sets) {
    const key = `${s.day} ${s.venue}`;
    perRoom.set(key, (perRoom.get(key) ?? 0) + 1);
  }
  for (const key of new Set([...perRoom.keys(), ...Object.keys(EXPECTED_SETS_PER_ROOM)])) {
    const got = perRoom.get(key) ?? 0;
    const want = EXPECTED_SETS_PER_ROOM[key] ?? 0;
    if (got !== want) errors.push(`${key}: PDF shows ${want} sets, snapshot has ${got}.`);
  }

  for (const s of sets) {
    if (!/^\d\d:\d\d$/.test(s.start) || !/^\d\d:\d\d$/.test(s.end)) {
      errors.push(`${s.artist}: malformed time ${s.start}-${s.end}.`);
      continue;
    }
    if (s.kind === "band" && (s.start < BAND_WINDOW.from || s.end > BAND_WINDOW.to || s.end <= s.start)) {
      errors.push(`${s.artist} (${s.day} ${s.venue}) ${s.start}-${s.end} is outside ${BAND_WINDOW.from}-${BAND_WINDOW.to}.`);
    }
  }

  return errors;
}

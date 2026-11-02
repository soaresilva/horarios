// Pure planning for the Primavera Sound 2027 importer: snapshot rows ->
// performance rows, plus the checks that make a bad snapshot fail before it
// reaches a database. No Prisma, no I/O, so all of it is gate-tested.
//
// The snapshot is a GUESS. The festival has published the day split only, so
// every stage and time in scripts/data/ps27.json is predicted from the poster
// and the PS24/PS26 grids. POSTER_ACTS below is the one part that is fact.
import { zoneOffset } from "../../src/lib/time";
import { findOverlaps } from "../touo/plan";

export const PS_FESTIVAL_ID = "ps27";
export const PS_ID_PREFIX = "ps27-p-";
const TIMEZONE = "Europe/Madrid";

export type PsDay = "WED" | "THU" | "FRI" | "SAT" | "SUN";

export const DAY_DATES: Record<PsDay, string> = {
  WED: "2027-06-02",
  THU: "2027-06-03",
  FRI: "2027-06-04",
  SAT: "2027-06-05",
  SUN: "2027-06-06",
};

export const MAIN_STAGES = ["estrella-damm", "revolut"] as const;
export const MID_STAGES = ["occident", "cupra"] as const;
export const SMALL_STAGES = ["schwarzkopf", "port"] as const;
export const AUDITORI = "auditori-rockdelux";
export const SIDE_STAGES = ["cupra-pulse", "levis-warehouse", "plenitude"] as const;
/** Wednesday and Sunday: the lineup is known, the stage isn't. */
export const OPEN_AIR_STAGE = "parc-del-forum";

/** Diogo's seven, the only stages pattern fit is measured on. */
export const CORE_STAGES: readonly string[] = [...MAIN_STAGES, ...MID_STAGES, ...SMALL_STAGES, AUDITORI];

const FESTIVAL_STAGES: readonly string[] = [...CORE_STAGES, ...SIDE_STAGES];

/** Must agree with the Stage rows in prisma/migrations/…_add_published_and_ps27_festival. */
export const STAGES_BY_DAY: Record<PsDay, readonly string[]> = {
  WED: [OPEN_AIR_STAGE],
  THU: FESTIVAL_STAGES,
  FRI: FESTIVAL_STAGES,
  SAT: FESTIVAL_STAGES,
  SUN: [OPEN_AIR_STAGE],
};

/**
 * The poster, day by day, one array per font size (largest first). Typed in
 * from the poster independently of the guess, and checked against the
 * per-day list on dodmagazine.es: if a revised poster adds or moves an act,
 * this disagrees with the snapshot and the import stops. Update it from the
 * poster, never from the snapshot.
 *
 * "Dulce" and "Gazella" are two acts split over a poster line break: DOD's
 * list runs them together, but Gazella is a Valencian band and Dulce a DJ.
 */
export const POSTER_ACTS: Record<PsDay, readonly (readonly string[])[]> = {
  WED: [["Underworld", "CHVRCHES", "Mushka"], ["Fades"]],
  THU: [
    ["Fontaines D.C."],
    ["Massive Attack", "Turnstile", "Robyn", "Bad Gyal"],
    [
      "Pavement", "Kim Petras", "Metronomy", "Wallows", "Snow Strippers", "Underscores",
      "Brutalismus 3000 b2b Isoxo", "Metrika", "Joy Orbison", "Atlas Sound",
    ],
    [
      "Greg Freeman", "Juana Molina", "Haute & Freddy", "Sophia Stel", "Westside Cowboy",
      "EAR", "Castle Rat", "Friko", "Gilla Band", "Jersey", "Alemeda", "Viva Belgrado",
      "Dame Area", "Guillem Gisbert",
    ],
    [
      "Alex vs Alex", "Al·lèrgiques al Pol·len", "Axolotes Mexicanos", "Blackhaine", "Blaya",
      "Carmen Villain", "Decoder", "Eden Aurelius", "DJ Fra", "Headache", "Ibrahim Alfa Jnr",
      "Madra Salach", "Napa", "Pole 1 2 3", "Tatyana Jane", "Tracey", "Trickpony", "Tristán!",
      "TTSSFU", "Verushka b2b Acidheaven",
    ],
  ],
  FRI: [
    ["Phoebe Bridgers"],
    ["FKA twigs", "The Chemical Brothers", "Tinashe"],
    [
      "Bleachers", "Anohni", "Angine de Poitrine", "JT", "Isaiah Rashad", "Bicep Live",
      "Boy Harsher", "Pablopablo", "Weyes Blood", "Vashti Bunyan", "Julien Baker", "Converge",
      "Akriila",
    ],
    [
      "Have a Nice Life", "English Teacher", "Racing Mount Pleasant", "Mishima", "Lip Critic",
      "@", "Los Punsetes", "Kelsey Lu", "John Talabot", "Full of Hell", "Mabe Fratti",
      "Don Caballero", "Carlos de Jacoba & Ciutat", "S.A.S.S.",
    ],
    [
      "Aeronave Adolescente", "Carré", "El Buen Hijo", "Irenegarry", "Klara Lewis", "Lux Lisbon",
      "Mad Miran b2b DJ Zero", "Malibu", "Mark Fell & RP Boo Live", "Memory Palace", "Naone",
      "Oceanic (Live AV)", "Perfecto Miserable", "Picture Live", "Piss", "Polygonia Live",
      "Roly Porter", "Sky H1 Live",
    ],
  ],
  SAT: [
    ["Doechii"],
    ["Hayley Williams", "Adéla", "Lola Young", "Prospa", "Skrillex b2b Ninajirachi"],
    [
      "Caroline Polachek", "King Gizzard and the Lizard Wizard", "Esdeekid", "Arca", "Theodora",
      "Shygirl", "Dinosaur Jr.", "Hearts2Hearts", "Muna", "Bonnie \"Prince\" Billy", "DIIV",
    ],
    [
      "Erin LeCount", "Santiago Motorizado", "Abhir", "Alcalá Norte", "Dove Ellis", "Rebe",
      "Simian Mobile Disco", "Jesu", "B0yg1rl", "Twisted Teens", "Tirzah", "Prostitute",
    ],
    [
      "Andy Stott", "Bae Bae", "Bashkka b2b Mike Servito", "Blanco Palamera", "Dani Dicostas",
      "Dulce", "Gazella", "Jump Source Live", "Livwutang b2b Konduku", "Loradeniz",
      "Marta Salogni Live", "Mori", "Plo Man", "DJ /rupture",
      "Sonido Underground: Dngdngdng & Phran", "DJ Stingray 313 Live", "Victoryland", "Warning",
    ],
  ],
  SUN: [["Richie Hawtin x Four Tet x Dixon"]],
};

/** "Closing*set" on the poster: nothing on the two main stages may end after it. */
export const CLOSING_SET = "Skrillex b2b Ninajirachi";

export interface PsSet {
  day: PsDay;
  stage: string;
  /** Exactly as in POSTER_ACTS. */
  name: string;
  start: string;
  end: string;
  /** Why this act got this slot, for reviewing the guess as a diff. */
  why: string;
}

export interface PsSnapshot {
  source: string;
  notes: string;
  generatedAt: string;
  sets: PsSet[];
}

export interface PlannedPs {
  id: string;
  artistName: string;
  stageSlug: string;
  date: string;
  startTime: Date;
  endTime: Date;
}

const HHMM = /^\d\d:\d\d$/;

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Row id: one act plays once, so this is stable however often the guess moves it. */
export function performanceId(set: Pick<PsSet, "day" | "name">): string {
  // "@" is the band's whole name, so it has nothing to slug.
  return `${PS_ID_PREFIX}${set.day.toLowerCase()}-${slugify(set.name) || "at"}`;
}

/**
 * The instant of a clock time on a festival day. Anything before noon belongs
 * to the next calendar morning. Deliberately not fromFestivalDayTime: its
 * 06:00 roll leaves a 06:00 end on the same day as its 04:30 start. No DST
 * change falls inside the festival, so one offset covers the whole night.
 */
export function instantAt(date: string, clock: string): Date {
  const midnight = Date.parse(`${date}T00:00:00${zoneOffset(TIMEZONE, date)}`);
  return new Date(midnight + clockMinutes(clock) * 60_000);
}

/** Minutes after the festival day's midnight: 01:20 is 1520, past the 17:30 it follows. */
export function clockMinutes(clock: string): number {
  const hours = Number(clock.slice(0, 2));
  return ((hours < 12 ? hours + 24 : hours) * 60) + Number(clock.slice(3));
}

export function planPs(snapshot: PsSnapshot): PlannedPs[] {
  return snapshot.sets.map((set) => {
    const date = DAY_DATES[set.day];
    return {
      id: performanceId(set),
      artistName: set.name,
      stageSlug: set.stage,
      date,
      startTime: instantAt(date, set.start),
      endTime: instantAt(date, set.end),
    };
  });
}

/** 1 for the biggest line on the poster, undefined for a name not on that day. */
export function posterTier(day: PsDay, name: string): number | undefined {
  const index = POSTER_ACTS[day].findIndex((line) => line.includes(name));
  return index === -1 ? undefined : index + 1;
}

const includes = (list: readonly string[], value: string) => list.includes(value);
const REGULAR_DAYS: readonly PsDay[] = ["THU", "FRI", "SAT"];
const SMALLEST_TIER = 5;

/** Everything wrong with a snapshot, as human-readable lines. Empty means safe to apply. */
export function validatePsSnapshot(snapshot: PsSnapshot): string[] {
  const errors: string[] = [];
  const { sets } = snapshot;

  // Every poster act exactly once, on its poster day, and nothing else.
  for (const day of Object.keys(POSTER_ACTS) as PsDay[]) {
    const posted = POSTER_ACTS[day].flat();
    const placed = sets.filter((s) => s.day === day).map((s) => s.name);
    for (const name of posted) {
      const times = placed.filter((n) => n === name).length;
      if (times !== 1) errors.push(`${name}: on the ${day} poster, placed ${times} times.`);
    }
    for (const name of new Set(placed)) {
      if (!posted.includes(name)) errors.push(`${name}: placed on ${day}, not on that day's poster.`);
    }
  }

  for (const s of sets) {
    const label = `${s.name} (${s.day} ${s.stage})`;
    if (!(s.day in DAY_DATES)) {
      errors.push(`${label}: unknown day.`);
      continue;
    }
    if (!STAGES_BY_DAY[s.day].includes(s.stage)) errors.push(`${label}: no such stage on ${s.day}.`);
    if (!s.why?.trim()) errors.push(`${label}: no reasoning.`);
    if (!HHMM.test(s.start) || !HHMM.test(s.end)) {
      errors.push(`${label}: malformed time ${s.start}-${s.end}.`);
      continue;
    }
    if (Number(s.start.slice(3)) % 5 !== 0 || Number(s.end.slice(3)) % 5 !== 0) {
      errors.push(`${label}: ${s.start}-${s.end} is off the 5-minute grid.`);
    }
    if (clockMinutes(s.end) <= clockMinutes(s.start)) {
      errors.push(`${label}: ends (${s.end}) before it starts (${s.start}).`);
    }

    if (!includes(REGULAR_DAYS, s.day)) continue;
    const tier = posterTier(s.day, s.name);
    if (tier === undefined) continue; // Already reported above.
    if (tier <= 2 && !includes(MAIN_STAGES, s.stage)) {
      errors.push(`${label}: poster line ${tier} belongs on a main stage.`);
    }
    if (tier < SMALLEST_TIER && includes(SIDE_STAGES, s.stage)) {
      errors.push(`${label}: poster line ${tier} is too big for a side stage.`);
    }
    if (tier === SMALLEST_TIER && (includes(MAIN_STAGES, s.stage) || includes(MID_STAGES, s.stage))) {
      errors.push(`${label}: the poster's smallest print can't take a main or mid-size slot.`);
    }
    if (tier === 1) {
      const start = clockMinutes(s.start);
      if (start < 21 * 60 + 30 || start > 24 * 60) errors.push(`${label}: top of the bill starts at ${s.start}, outside prime time.`);
    }
  }

  const ids = new Map<string, string>();
  for (const s of sets) {
    const id = performanceId(s);
    if (ids.has(id)) errors.push(`Duplicate id ${id}: ${ids.get(id)} and ${s.name}.`);
    ids.set(id, s.name);
  }

  const planned = planPs(snapshot).map((p) => ({
    id: p.id,
    label: p.artistName,
    stageKey: `${p.date} ${p.stageSlug}`,
    startTime: p.startTime,
    endTime: p.endTime,
  }));
  errors.push(...findOverlaps(planned));
  // The two main stages take turns: true of every PS24 and PS26 day.
  errors.push(
    ...findOverlaps(
      planned
        .filter((p) => MAIN_STAGES.some((stage) => p.stageKey.endsWith(` ${stage}`)))
        .map((p) => ({ ...p, stageKey: `${p.stageKey.slice(0, 10)} main stages` })),
    ),
  );

  const closing = sets.find((s) => s.name === CLOSING_SET);
  if (closing && !includes(MAIN_STAGES, closing.stage)) errors.push(`${CLOSING_SET} is the closing set: main stage only.`);
  for (const s of sets) {
    if (!closing || s === closing || s.day !== closing.day || !includes(MAIN_STAGES, s.stage)) continue;
    if (clockMinutes(s.end) > clockMinutes(closing.end)) {
      errors.push(`${s.name} ends after the closing set (${s.end}).`);
    }
  }

  return errors;
}

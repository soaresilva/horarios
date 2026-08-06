import { prisma } from "../src/lib/prisma";

// Real confirmed schedule, sourced from Diogo directly:
// - Aug 12-15 Vodafone / Coura Sem Paredes: officially revealed per-stage
//   lineup (start times only, no durations published). Vodafone and Coura
//   Sem Paredes strictly alternate all four nights — merging both stages'
//   starts chronologically shows zero overlap — so each act's end time is
//   guessed as the next act's start time, on either stage, whichever comes
//   first. Each night's final act (no following act) gets a flat +75min
//   guess, matching the closing-set lengths already used elsewhere in this
//   lineup (Bassvictim/Marie Davidson DJ Set/Amyl and the Sniffers were all
//   guessed at 75-90min previously). Superseded a pre-reveal guessed lineup
//   that had different stage assignments for several acts.
// - Aug 9-11 (Sobe à Vila) and the Jazz na Relva / Xapas Lounge times: given
//   directly as confirmed lineup images. Duration isn't published for these
//   smaller stages, so each act is a flat 45min, except the last act of
//   each Sobe à Vila day (90min, per Diogo).

const YEAR = 2026;
const pad = (n: number) => String(n).padStart(2, "0");

// Paredes de Coura runs in mainland Portugal, which is on WEST (UTC+1)
// throughout the festival in August. Times are built with an explicit
// +01:00 offset so the stored instant matches real Lisbon wall-clock time
// regardless of the timezone this script (or a viewer's device) runs in.
function at(day: number, hhmm: string, rolls: boolean) {
  const d = rolls ? day + 1 : day;
  return new Date(`${YEAR}-08-${pad(d)}T${hhmm}:00+01:00`);
}

// The `date` column is a plain calendar-date label (Prisma @db.Date, no
// timezone), unlike startTime/endTime which are real instants. Building it
// through a +01:00 offset would shift it to the previous UTC day, so this
// uses UTC midnight directly instead.
function festivalDate(day: number) {
  return new Date(Date.UTC(YEAR, 7, day));
}

// Every festival-day's schedule runs from mid-afternoon (earliest: Jazz na
// Relva at 15:00) through the small hours (latest: ~04:40) — nothing falls
// in between, so a clock hour before 06:00 means "after midnight, next
// calendar day" relative to the festival-day label. Same boundary as
// `festivalTimeRolls` in src/lib/time.ts (kept at 06:00 rather than 13:00 so
// the admin can enter early-afternoon slots); identical output for every
// seeded time, which all fall outside 06:00–15:00.
function rolls(hhmm: string): boolean {
  return Number(hhmm.split(":")[0]) < 6;
}

interface Act {
  artist: string;
  start: string;
  end: string;
  // Override the computed rolls() result for this endpoint. Needed only for
  // 16 Aug's Dupplo set (04:20-06:15), which straddles the 06:00 boundary
  // that every other day's programme stays clear of (see the comment above
  // `rolls()`) — without this, the heuristic would push its 04:20 start onto
  // the 17th while leaving 06:15 on the 16th, making end < start.
  startRolls?: boolean;
  endRolls?: boolean;
}

// `order` sets both the main-grid pairing (the two lowest-order active,
// grid-eligible stages pair side-by-side) and the top-to-bottom order of the
// stacked side sections. Quarto Mundo (daytime) is always stacked regardless
// of order — see ALWAYS_STACKED_SLUGS in grouping.ts. Its order 3 just puts it
// at the top of the stack; the evening stages below it still pair up
// (Vodafone+Coura Sem Paredes on the main days, Sobe à Vila+Xapas Lounge on 10-11 Aug).
const STAGES = [
  { slug: "vodafone", name: "Vodafone", order: 0 },
  { slug: "palco-2", name: "Coura Sem Paredes", order: 1 },
  { slug: "sobe-a-vila", name: "Sobe à Vila", order: 2 },
  { slug: "quarto-mundo", name: "Quarto Mundo Sessions by Cabriz", order: 3 },
  { slug: "jazz-na-relva", name: "Jazz na Relva by Pleno", order: 4 },
  { slug: "xapas-lounge", name: "Xapas Lounge", order: 5 },
] as const;

// day -> stageSlug -> acts, sorted by start time.
const SCHEDULE: Record<number, Record<string, Act[]>> = {
  12: {
    vodafone: [
      { artist: "Westside Cowboy", start: "17:25", end: "18:25" },
      { artist: "First Breath After Coma + Salvador Sobral", start: "19:15", end: "20:15" },
      { artist: "CMAT", start: "21:00", end: "22:05" },
      { artist: "Wet Leg", start: "23:05", end: "00:20" },
      { artist: "Kneecap", start: "01:25", end: "02:40" },
    ],
    "palco-2": [
      { artist: "Miramar", start: "16:45", end: "17:25" },
      { artist: "Greg Freeman", start: "18:25", end: "19:15" },
      { artist: "Horsegirl", start: "20:15", end: "21:00" },
      { artist: "Capitão Fausto", start: "22:05", end: "23:05" },
      { artist: "The Horrors", start: "00:20", end: "01:25" },
      { artist: "Getdown Services", start: "02:40", end: "04:00" },
      { artist: "University", start: "04:00", end: "05:15" },
    ],
    "jazz-na-relva": [
      { artist: "Joana Alegre", start: "15:00", end: "15:45" },
      { artist: "Janeiro", start: "16:00", end: "16:45" },
    ],
    "quarto-mundo": [{ artist: "Quarto Mundo", start: "11:00", end: "15:00" }],
  },
  13: {
    vodafone: [
      { artist: "A Garota Não", start: "17:10", end: "18:00" },
      { artist: "Aldous Harding", start: "19:00", end: "20:00" },
      { artist: "Kurt Vile & The Violators", start: "21:00", end: "22:15" },
      { artist: "Hermanos Gutiérrez", start: "23:15", end: "00:30" },
      { artist: "Underworld", start: "01:30", end: "02:45" },
    ],
    "palco-2": [
      { artist: "Milhanas", start: "16:30", end: "17:10" },
      { artist: "Tomode", start: "18:00", end: "19:00" },
      { artist: "Friko", start: "20:00", end: "21:00" },
      { artist: "Pale Jay", start: "22:15", end: "23:15" },
      { artist: "Wu Lyf", start: "00:30", end: "01:30" },
      { artist: "Show Me The Body", start: "02:45", end: "03:45" },
      { artist: "Bassvictim", start: "03:45", end: "05:00" },
    ],
    "jazz-na-relva": [
      { artist: "Miguel Marôco", start: "15:00", end: "15:45" },
      { artist: "Salvador Sobral e André Santos", start: "16:00", end: "16:45" },
    ],
    "xapas-lounge": [{ artist: "GPSS", start: "15:00", end: "15:45" }],
    "quarto-mundo": [{ artist: "Sounzstore", start: "11:00", end: "15:00" }],
  },
  14: {
    vodafone: [
      { artist: "Carolina Durante", start: "16:55", end: "17:55" },
      { artist: "Sérgio & Os Assessores Com Amigos", start: "18:40", end: "19:55" },
      { artist: "Benjamin Clementine", start: "20:40", end: "21:55" },
      { artist: "Bloc Party", start: "22:45", end: "00:00" },
      { artist: "M.I.A.", start: "01:00", end: "02:00" },
    ],
    "palco-2": [
      { artist: "Noko Woi", start: "16:15", end: "16:55" },
      { artist: "Strawberry Guy", start: "17:55", end: "18:40" },
      { artist: "Ryan Davis and the Roadhouse Band", start: "19:55", end: "20:40" },
      { artist: "Terraplana", start: "21:55", end: "22:45" },
      { artist: "Vendredi Sur Mer", start: "00:00", end: "01:00" },
      { artist: "Maruja", start: "02:00", end: "03:00" },
      { artist: "Joy Orbison", start: "03:25", end: "04:40" },
    ],
    "jazz-na-relva": [
      { artist: "Plaka", start: "15:00", end: "15:45" },
      { artist: "Maria Luiza Jobim", start: "16:00", end: "16:45" },
    ],
    "quarto-mundo": [{ artist: "Quarto Mundo", start: "11:00", end: "15:00" }],
  },
  15: {
    vodafone: [
      { artist: "Patrick Watson", start: "17:10", end: "18:10" },
      { artist: "Cate Le Bon", start: "18:55", end: "19:55" },
      { artist: "Meute", start: "20:45", end: "21:45" },
      { artist: "Thundercat", start: "22:45", end: "23:45" },
      { artist: "Amyl and the Sniffers", start: "00:35", end: "01:35" },
    ],
    "palco-2": [
      { artist: "Noiserv", start: "16:30", end: "17:10" },
      { artist: "Hudson Freeman", start: "18:10", end: "18:55" },
      { artist: "Sophia Stel", start: "19:55", end: "20:45" },
      { artist: "Julia Mestre", start: "21:45", end: "22:45" },
      { artist: "Prostitute", start: "23:45", end: "00:35" },
      { artist: "Dame Area", start: "01:35", end: "02:35" },
      { artist: "Marie Davidson DJ Set", start: "02:50", end: "04:05" },
    ],
    "jazz-na-relva": [
      { artist: "Rita Cortezão", start: "15:00", end: "15:45" },
      { artist: "Asa Cobra", start: "16:00", end: "16:45" },
    ],
    "quarto-mundo": [{ artist: "Trol2000", start: "11:00", end: "15:00" }],
  },
  9: {
    "sobe-a-vila": [
      { artist: "Summer of Hate", start: "22:30", end: "23:15" },
      { artist: "Colinas", start: "23:30", end: "00:15" },
      { artist: "Hetta", start: "00:30", end: "01:15" },
      { artist: "DJ Shake a Leg", start: "01:20", end: "02:50" },
    ],
  },
  10: {
    "sobe-a-vila": [
      { artist: "Alex Moon", start: "22:30", end: "23:15" },
      { artist: "Sofia Araújo", start: "00:00", end: "00:45" },
      { artist: "Francisco AP", start: "01:30", end: "03:00" },
    ],
    "quarto-mundo": [{ artist: "Quarto Mundo", start: "11:00", end: "15:00" }],
  },
  11: {
    "sobe-a-vila": [
      { artist: "Nunca Mates o Mandarim", start: "22:30", end: "23:15" },
      { artist: "La Familia Gitana", start: "23:30", end: "00:15" },
      { artist: "Halfpipe Records", start: "00:30", end: "02:00" },
    ],
    "quarto-mundo": [{ artist: "James Keating", start: "11:00", end: "15:00" }],
  },
  // Bonus afterparty day, confirmed by Diogo. All three acts on Jazz na
  // Relva; "Quarto Mundo" here is just the 15:00-17:00 act's name, not the
  // separate Quarto Mundo Sessions stage.
  16: {
    "jazz-na-relva": [
      { artist: "Dupplo", start: "04:20", end: "06:15", startRolls: false },
      { artist: "Armanda", start: "06:15", end: "08:00" },
      { artist: "Quarto Mundo", start: "15:00", end: "17:00" },
    ],
  },
};

async function main() {
  console.log("Seeding confirmed 2026 schedule...");

  const stageIds: Record<string, string> = {};
  for (const stage of STAGES) {
    const row = await prisma.stage.upsert({
      where: { slug: stage.slug },
      update: { name: stage.name, order: stage.order },
      create: stage,
    });
    stageIds[stage.slug] = row.id;
  }

  await prisma.performance.deleteMany({});

  for (const [dayStr, stages] of Object.entries(SCHEDULE)) {
    const day = Number(dayStr);
    const date = festivalDate(day);

    for (const [stageSlug, acts] of Object.entries(stages)) {
      for (const act of acts) {
        await prisma.performance.create({
          data: {
            artistName: act.artist,
            date,
            startTime: at(day, act.start, act.startRolls ?? rolls(act.start)),
            endTime: at(day, act.end, act.endRolls ?? rolls(act.end)),
            stageId: stageIds[stageSlug],
          },
        });
      }
    }
  }

  const count = await prisma.performance.count();
  console.log(`Seeded ${count} performances across ${STAGES.length} stages.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

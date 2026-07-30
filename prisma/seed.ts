import { prisma } from "../src/lib/prisma";

// Real confirmed schedule, sourced from Diogo directly:
// - Aug 12-15 (Vodafone / COURA / Jazz na Relva / Xapas Lounge): extracted
//   from his working spreadsheet (BolachasPdC26.xlsx, per-day sheets "12
//   Ago".."15 Ago"), which gives each act's actual start time and a
//   merge-derived duration. Two acts had a merge-derived end that slightly
//   overran the next act's start on the same stage (Getdown Services/
//   Miramar on the 12th by 5min, Tomode/Milhanas on the 13th by 15min) —
//   capped at the next act's start rather than guessed away.
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
}

// order 0-2 are the "big" stages that can headline the two-column main grid
// (Vodafone/COURA on the main days, Sobe à Vila on the pre-festival days);
// order >= 3 are side-programme stages that always render as their own
// stacked single-column section (see MAIN_STAGE_MAX_ORDER in grouping.ts).
const STAGES = [
  { slug: "vodafone", name: "Vodafone", order: 0 },
  { slug: "palco-2", name: "COURA", order: 1 },
  { slug: "sobe-a-vila", name: "Sobe à Vila", order: 2 },
  { slug: "quarto-mundo", name: "Quarto Mundo Sessions by Cabriz", order: 3 },
  { slug: "jazz-na-relva", name: "Jazz na Relva by Pleno", order: 4 },
  { slug: "xapas-lounge", name: "Xapas Lounge", order: 5 },
] as const;

// day -> stageSlug -> acts, sorted by start time.
const SCHEDULE: Record<number, Record<string, Act[]>> = {
  12: {
    vodafone: [
      { artist: "Capitão Fausto", start: "17:15", end: "18:15" },
      { artist: "CMAT", start: "18:40", end: "19:40" },
      { artist: "The Horrors", start: "20:40", end: "21:40" },
      { artist: "Wet Leg", start: "22:25", end: "23:25" },
      { artist: "Kneecap", start: "00:20", end: "01:50" },
    ],
    "palco-2": [
      { artist: "University", start: "16:30", end: "17:15" },
      { artist: "Westside Cowboy", start: "18:00", end: "19:00" },
      { artist: "Greg Freeman", start: "19:40", end: "20:40" },
      { artist: "Horsegirl", start: "21:40", end: "22:40" },
      { artist: "First Breath After Coma + Salvador Sobral", start: "23:35", end: "00:35" },
      { artist: "Getdown Services", start: "01:50", end: "02:45" },
      { artist: "Miramar", start: "02:45", end: "04:30" },
    ],
    "jazz-na-relva": [
      { artist: "Joana Alegre", start: "15:00", end: "15:45" },
      { artist: "Janeiro", start: "16:00", end: "16:45" },
    ],
    "quarto-mundo": [{ artist: "Quarto Mundo", start: "11:00", end: "15:00" }],
  },
  13: {
    vodafone: [
      { artist: "A Garota Não", start: "17:10", end: "18:10" },
      { artist: "Aldous Harding", start: "18:40", end: "19:40" },
      { artist: "Hermanos Gutiérrez", start: "20:40", end: "21:55" },
      { artist: "Kurt Vile & The Violators", start: "22:40", end: "23:40" },
      { artist: "Underworld", start: "00:35", end: "01:50" },
    ],
    "palco-2": [
      { artist: "Tomode", start: "17:30", end: "18:00" },
      { artist: "Milhanas", start: "18:00", end: "19:00" },
      { artist: "Pale Jay", start: "19:40", end: "20:40" },
      { artist: "Friko", start: "21:40", end: "22:40" },
      { artist: "Wu Lyf", start: "23:40", end: "00:40" },
      { artist: "Show Me The Body", start: "01:50", end: "02:50" },
      { artist: "Bassvictim", start: "03:00", end: "04:30" },
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
      { artist: "Carolina Durante", start: "17:10", end: "18:10" },
      { artist: "Sérgio & Os Assessores Com Amigos", start: "18:50", end: "19:50" },
      { artist: "Benjamin Clementine", start: "20:45", end: "21:45" },
      { artist: "Bloc Party", start: "22:35", end: "23:50" },
      { artist: "M.I.A.", start: "00:35", end: "01:50" },
    ],
    "palco-2": [
      { artist: "Noko Woi", start: "16:30", end: "17:15" },
      { artist: "Terraplana", start: "18:00", end: "19:00" },
      { artist: "Strawberry Guy", start: "19:50", end: "20:50" },
      { artist: "Ryan Davis & The Roadhouse Band", start: "21:50", end: "22:50" },
      { artist: "Vendredi Sur Mer", start: "23:50", end: "00:50" },
      { artist: "Maruja", start: "01:35", end: "02:35" },
      { artist: "Joy Orbison", start: "02:45", end: "04:30" },
    ],
    "jazz-na-relva": [
      { artist: "Plaka", start: "15:00", end: "15:45" },
      { artist: "Maria Luiza Jobim", start: "16:00", end: "16:45" },
    ],
    "quarto-mundo": [{ artist: "Quarto Mundo", start: "11:00", end: "15:00" }],
  },
  15: {
    vodafone: [
      { artist: "Patrick Watson Solo Piano", start: "17:10", end: "18:10" },
      { artist: "Cate Le Bon", start: "18:55", end: "19:55" },
      { artist: "Meute", start: "20:40", end: "21:55" },
      { artist: "Thundercat", start: "22:45", end: "00:00" },
      { artist: "Amyl and the Sniffers", start: "01:00", end: "02:15" },
    ],
    "palco-2": [
      { artist: "Hudson Freeman", start: "16:30", end: "17:15" },
      { artist: "Sophia Stel", start: "18:10", end: "19:10" },
      { artist: "Noiserv", start: "19:55", end: "20:55" },
      { artist: "Julia Mestre", start: "21:45", end: "22:45" },
      { artist: "Prostitute", start: "00:00", end: "01:00" },
      { artist: "Dame Area", start: "02:20", end: "03:20" },
      { artist: "Marie Davidson DJ Set", start: "03:25", end: "04:40" },
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
            startTime: at(day, act.start, rolls(act.start)),
            endTime: at(day, act.end, rolls(act.end)),
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

import { prisma } from "../src/lib/prisma";

// No official 2026 set times exist yet (only the artist lineup has been
// announced). This seed fabricates a plausible schedule so the app has
// something to render during development and before Diogo replaces it
// with real times via /admin once the festival publishes them.

const YEAR = 2026;
const pad = (n: number) => String(n).padStart(2, "0");

// Paredes de Coura runs in mainland Portugal, which is on WEST (UTC+1)
// throughout the festival in August. Times are built with an explicit
// +01:00 offset so the stored instant matches real Lisbon wall-clock time
// regardless of the timezone this script (or a viewer's device) runs in.
function at(day: number, hour: number, minute: number, rollsToNextDay = false) {
  const d = rollsToNextDay ? day + 1 : day;
  return new Date(`${YEAR}-08-${pad(d)}T${pad(hour)}:${pad(minute)}:00+01:00`);
}

// The `date` column is a plain calendar-date label (Prisma @db.Date, no
// timezone), unlike startTime/endTime which are real instants. Building it
// through a +01:00 offset would shift it to the previous UTC day, so this
// uses UTC midnight directly instead.
function festivalDate(day: number) {
  return new Date(Date.UTC(YEAR, 7, day));
}

// `startRolls`/`endRolls` mark whether that specific endpoint falls after
// midnight, i.e. on the calendar day following the festival-day label (a
// slot can start before midnight and end after it, or - for a stage's
// closing slot - start and end both after midnight).
type SlotTemplate = {
  start: [number, number];
  end: [number, number];
  startRolls?: boolean;
  endRolls?: boolean;
};

// Six slots per stage per main day, offset ~20-30min between stages so
// Vodafone and Palco 2 alternate rather than overlap exactly, mirroring
// the bolachas.org reference timetable's cadence.
const VODAFONE_SLOTS: SlotTemplate[] = [
  { start: [16, 45], end: [17, 30] },
  { start: [18, 0], end: [18, 45] },
  { start: [19, 15], end: [20, 15] },
  { start: [20, 45], end: [21, 45] },
  { start: [22, 15], end: [23, 15] },
  { start: [23, 45], end: [1, 0], endRolls: true },
];

const PALCO2_SLOTS: SlotTemplate[] = [
  { start: [17, 0], end: [17, 45] },
  { start: [18, 20], end: [19, 5] },
  { start: [19, 35], end: [20, 35] },
  { start: [21, 5], end: [22, 5] },
  { start: [22, 35], end: [23, 35] },
  { start: [0, 5], end: [1, 20], startRolls: true, endRolls: true },
];

const MAIN_LINEUP: Record<number, { vodafone: string[]; palco2: string[] }> = {
  12: {
    vodafone: ["Amyl and the Sniffers", "Wet Leg", "Kneecap", "Bloc Party", "Underworld", "M.I.A."],
    palco2: ["Patrick Watson Solo Piano", "Hermanos Gutiérrez", "CMAT", "Meute", "Benjamin Clementine", "Thundercat"],
  },
  13: {
    vodafone: ["Pale Jay", "Cate Le Bon", "The Horrors", "Aldous Harding", "Joy Orbison", "Kurt Vile & The Violators"],
    palco2: ["Bassvictim", "Getdown Services", "Show Me The Body", "Wu Lyf", "Carolina Durante", "Maruja"],
  },
  14: {
    vodafone: ["Hudson Freeman", "Sophia Stel", "Terraplana", "Greg Freeman", "Ryan Davis & The Roadhouse Band", "Marie Davidson DJ Set"],
    palco2: ["Westside Cowboy", "Strawberry Guy", "Friko", "Vendredi Sur Mer", "Prostitute", "Dame Area"],
  },
  15: {
    vodafone: ["Julia Mestre", "Tomode", "A Garota Não", "Sérgio & Os Assessores Com Amigos", "First Breath After Coma + Salvador Sobral", "Capitão Fausto"],
    palco2: ["Milhanas", "University", "Noko Woi", "Miramar", "Horsegirl", "Noiserv"],
  },
};

// Real stage name confirmed from the official site; scoped to its own
// pre-festival tab per Diogo's instructions, not the main side-by-side grid.
const PRE_FESTIVAL: Record<number, string[]> = {
  9: ["Colinas", "DJ Set"],
  10: ["Hetta", "DJ Set"],
  11: ["Summer of Hate", "DJ Set"],
};

const PRE_FESTIVAL_SLOTS: SlotTemplate[] = [
  { start: [22, 30], end: [23, 30] },
  { start: [23, 30], end: [1, 30], endRolls: true },
];

async function main() {
  console.log("Seeding placeholder 2026 schedule...");

  const vodafone = await prisma.stage.upsert({
    where: { slug: "vodafone" },
    update: {},
    create: { name: "Vodafone", slug: "vodafone", order: 0 },
  });

  const palco2 = await prisma.stage.upsert({
    where: { slug: "palco-2" },
    update: {},
    create: { name: "Palco 2", slug: "palco-2", order: 1 },
  });

  const sobeAVila = await prisma.stage.upsert({
    where: { slug: "sobe-a-vila" },
    update: {},
    create: { name: "Sobe à Vila", slug: "sobe-a-vila", order: 2 },
  });

  await prisma.performance.deleteMany({});

  for (const [dayStr, { vodafone: vArtists, palco2: pArtists }] of Object.entries(MAIN_LINEUP)) {
    const day = Number(dayStr);
    const date = festivalDate(day);

    for (let i = 0; i < vArtists.length; i++) {
      const slot = VODAFONE_SLOTS[i];
      await prisma.performance.create({
        data: {
          artistName: vArtists[i],
          date,
          startTime: at(day, slot.start[0], slot.start[1], slot.startRolls),
          endTime: at(day, slot.end[0], slot.end[1], slot.endRolls),
          stageId: vodafone.id,
        },
      });
    }

    for (let i = 0; i < pArtists.length; i++) {
      const slot = PALCO2_SLOTS[i];
      await prisma.performance.create({
        data: {
          artistName: pArtists[i],
          date,
          startTime: at(day, slot.start[0], slot.start[1], slot.startRolls),
          endTime: at(day, slot.end[0], slot.end[1], slot.endRolls),
          stageId: palco2.id,
        },
      });
    }
  }

  for (const [dayStr, artists] of Object.entries(PRE_FESTIVAL)) {
    const day = Number(dayStr);
    const date = festivalDate(day);

    for (let i = 0; i < artists.length; i++) {
      const slot = PRE_FESTIVAL_SLOTS[i];
      await prisma.performance.create({
        data: {
          artistName: artists[i],
          date,
          startTime: at(day, slot.start[0], slot.start[1], slot.startRolls),
          endTime: at(day, slot.end[0], slot.end[1], slot.endRolls),
          stageId: sobeAVila.id,
        },
      });
    }
  }

  const count = await prisma.performance.count();
  console.log(`Seeded ${count} performances across 3 stages.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

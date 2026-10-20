// Read-only usage numbers for crews (src/app/crew/actions.ts): did people
// actually share picks? The number that matters per festival is "crews where
// at least two members marked something", since a crew of one, or a crew
// where only one person marks, shares nothing.
//
//   npm run stats:crews
//
// Against production, the same way the importers run there: pull the env
// into a scratch file (never .env.local), source it in a subshell, run this,
// delete the file. Only SELECTs, so it's safe at any time.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const sizes = await prisma.$queryRaw<{ size: number; crews: number }[]>`
    SELECT size::int AS size, COUNT(*)::int AS crews
    FROM (SELECT "crewId", COUNT(*) AS size FROM "CrewMember" GROUP BY "crewId") t
    GROUP BY size ORDER BY size`;

  const perFestival = await prisma.$queryRaw<{ slug: string; sharing: number; members: number }[]>`
    SELECT f.slug, COUNT(*)::int AS sharing, SUM(t.marking)::int AS members
    FROM (
      SELECT cm."crewId", s."festivalId", COUNT(DISTINCT cm."visitorId") AS marking
      FROM "CrewMember" cm
      JOIN "Favorite" fav ON fav."visitorId" = cm."visitorId" AND fav.tier IS NOT NULL
      JOIN "Performance" p ON p.id = fav."performanceId"
      JOIN "Stage" s ON s.id = p."stageId"
      GROUP BY cm."crewId", s."festivalId"
    ) t
    JOIN "Festival" f ON f.id = t."festivalId"
    WHERE t.marking >= 2
    GROUP BY f.slug ORDER BY f.slug`;

  const totalCrews = sizes.reduce((n, row) => n + row.crews, 0);
  const totalMembers = sizes.reduce((n, row) => n + row.size * row.crews, 0);
  console.log(`crews: ${totalCrews}, members: ${totalMembers}`);
  for (const row of sizes) console.log(`  ${row.size} ${row.size === 1 ? "person " : "people "}: ${row.crews}`);
  console.log("crews where 2+ members marked sets:");
  if (perFestival.length === 0) console.log("  none yet");
  for (const row of perFestival) console.log(`  ${row.slug}: ${row.sharing} crews, ${row.members} members marking`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

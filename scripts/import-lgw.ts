// Importer for Le Guess Who? 2026 (Utrecht, Thu 5 to Sun 8 November) and
// its U? side programme.
//
//   npm run import:lgw -- --fetch            network  -> scripts/data/lgw26.json
//   npm run import:lgw -- --check            validate the snapshot, no DB
//   npm run import:lgw -- --sql              print the zones/stages migration SQL
//   npm run import:lgw -- --apply --dry-run  report what would change
//   npm run import:lgw -- --apply            snapshot -> Postgres
//   npm run import:lgw -- --apply --prune    also remove sets that vanished
//
// Same two-phase shape as import-lotd.ts: a committed JSON snapshot sits
// between the network and the database, so a schedule change is a
// reviewable diff and a Vercel build never depends on leguesswho.com.
// Rows are `lgw26-p-<show_id>`; --prune only ever touches that prefix, so
// admin-entered (cuid) rows survive.
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { CRAWL_DELAY_MS, fetchPage, fetchTimetableDays } from "./lgw/livewire";
import { staleKindNames } from "./lgw/kinds";
import { buildStructureSql } from "./lgw/migration-sql";
import { daysOf, parseTimetableData, projectsOf, type Programme, type RawShow, type SourceProject } from "./lgw/parse";
import { FESTIVAL_ID, PERFORMANCE_ID_PREFIX, planLgw, type LgwPlan } from "./lgw/plan";
import { venuePageSlug, type LgwSnapshot } from "./lgw/snapshot";
import { parseVenuePage, type VenueFacts } from "./lgw/venue-page";

const SNAPSHOT = path.join(process.cwd(), "scripts", "data", "lgw26.json");
const PAGES: Record<Programme, string> = { LGW: "/timetable", "U?": "/u/timetable" };

const flag = (name: string) => process.argv.includes(`--${name}`);

async function runFetch() {
  const shows: RawShow[] = [];
  const projects = new Map<number, SourceProject>();
  const days = { LGW: [] as string[], "U?": [] as string[] };

  for (const programme of ["LGW", "U?"] as const) {
    console.log(`Fetching ${programme} timetable (${CRAWL_DELAY_MS / 1000}s between requests)…`);
    const byDay = await fetchTimetableDays(PAGES[programme], daysOf);
    days[programme] = Object.keys(byDay);
    for (const [day, data] of Object.entries(byDay)) {
      const parsed = parseTimetableData(data, programme, day);
      console.log(`  ${day}: ${parsed.length} shows`);
      shows.push(...parsed);
      for (const p of projectsOf(data)) projects.set(p.id, p);
    }
  }

  // A venue with no page is recorded as null, not fatal here: "Cartesius
  // Area" only carries the U? umbrella block that plan.ts drops. --check
  // fails if a show that is actually imported sits in a venue without facts.
  const venues: Record<string, VenueFacts | null> = {};
  const venueNames = [...new Set(shows.map((s) => s.venue))].sort();
  console.log(`Fetching ${venueNames.length} venue pages…`);
  for (const venue of venueNames) {
    const slug = venuePageSlug(venue);
    const html = await fetchPage(`/about/venues/${slug}`).catch((err: unknown) => {
      if (err instanceof Error && err.message.startsWith("404")) return null;
      throw err;
    });
    if (html === null) {
      console.log(`  ${venue}: no page at /about/venues/${slug} (fix VENUE_PAGE_SLUG_OVERRIDES if it's a real room)`);
      venues[venue] = null;
      continue;
    }
    venues[venue] = parseVenuePage(slug, html);
  }

  shows.sort((a, b) => a.programme.localeCompare(b.programme) || a.day.localeCompare(b.day) || a.start - b.start || a.showId - b.showId);
  const snapshot: LgwSnapshot = {
    source: Object.values(PAGES).map((p) => `https://leguesswho.com${p}`),
    fetchedAt: new Date().toISOString(),
    days,
    projects: [...projects.values()].sort((a, b) => a.id - b.id),
    shows,
    venues,
  };
  await mkdir(path.dirname(SNAPSHOT), { recursive: true });
  await writeFile(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Wrote ${shows.length} shows and ${venueNames.length} venues to ${path.relative(process.cwd(), SNAPSHOT)}.`);
}

async function loadSnapshot(): Promise<LgwSnapshot> {
  return JSON.parse(await readFile(SNAPSHOT, "utf8")) as LgwSnapshot;
}

/** Plan the snapshot and print what's in it; throws if anything is wrong. */
async function runCheck(): Promise<{ snapshot: LgwSnapshot; plan: LgwPlan }> {
  const snapshot = await loadSnapshot();
  const plan = planLgw(snapshot);
  const { performances: perfs } = plan;

  console.log(`Snapshot ${snapshot.fetchedAt}: ${snapshot.shows.length} timetable entries.`);
  console.log(
    `Planned ${perfs.length} sets (${plan.dropped.duplicates} listed in both timetables kept once, ` +
      `${plan.dropped.umbrellas} umbrella blocks dropped), ${plan.artists.length} acts.`,
  );
  const count = <K extends string>(keyOf: (p: (typeof perfs)[number]) => K) => {
    const m = new Map<K, number>();
    for (const p of perfs) m.set(keyOf(p), (m.get(keyOf(p)) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  for (const [key, n] of count((p) => `${p.date} ${p.series ?? "LGW"}`)) console.log(`  ${key}: ${n}`);
  console.log(`  by kind: ${count((p) => p.kind).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`  rooms used: ${new Set(perfs.map((p) => p.stageSlug)).size}`);

  const problems = [...plan.problems, ...staleKindNames(snapshot.shows)];
  if (problems.length) throw new Error(`Snapshot failed checks:\n  ${problems.join("\n  ")}`);
  console.log("All checks passed.");
  return { snapshot, plan };
}

async function runApply({ prune, dryRun }: { prune: boolean; dryRun: boolean }) {
  const { plan } = await runCheck();

  const [stages, existingArtists, existing] = await Promise.all([
    prisma.stage.findMany({ where: { festivalId: FESTIVAL_ID } }),
    prisma.artist.findMany({ where: { festivalId: FESTIVAL_ID } }),
    prisma.performance.findMany({ where: { stage: { festivalId: FESTIVAL_ID } } }),
  ]);
  const stageIdBySlug = new Map(stages.map((s) => [s.slug, s.id]));
  const artistById = new Map(existingArtists.map((a) => [a.id, a]));
  const performanceById = new Map(existing.map((p) => [p.id, p]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let artistsCreated = 0;
  let artistsUpdated = 0;
  let created = 0;
  let updated = 0;

  for (const a of plan.artists) {
    const current = artistById.get(a.id);
    const data = { name: a.name, sourceUrl: a.sourceUrl };
    if (!current) {
      artistsCreated++;
      ops.push(prisma.artist.create({ data: { id: a.id, festivalId: FESTIVAL_ID, slug: a.slug, ...data } }));
    } else if (current.name !== data.name || current.sourceUrl !== data.sourceUrl) {
      artistsUpdated++;
      ops.push(prisma.artist.update({ where: { id: a.id }, data }));
    }
  }

  for (const p of plan.performances) {
    const stageId = stageIdBySlug.get(p.stageSlug);
    if (!stageId) throw new Error(`No stage row for slug "${p.stageSlug}"; run migrations first.`);
    // Never touches `recommended` or `notes` (admin curation), same as
    // the other importers.
    const data = {
      artistName: p.artistName,
      date: new Date(`${p.date}T00:00:00Z`),
      startTime: p.startTime,
      endTime: p.endTime,
      stageId,
      artistId: p.artistId,
      series: p.series,
      host: p.host,
      kind: p.kind,
    };
    const current = performanceById.get(p.id);
    if (!current) {
      created++;
      ops.push(prisma.performance.create({ data: { id: p.id, ...data } }));
      continue;
    }
    // Skip no-op updates, so a rerun doesn't bump every updatedAt and
    // invalidate open /admin tabs for nothing.
    const unchanged =
      current.artistName === data.artistName &&
      current.date.toISOString() === data.date.toISOString() &&
      current.startTime.getTime() === data.startTime.getTime() &&
      current.endTime.getTime() === data.endTime.getTime() &&
      current.stageId === data.stageId &&
      current.artistId === data.artistId &&
      current.series === data.series &&
      current.host === data.host &&
      current.kind === data.kind;
    if (!unchanged) {
      updated++;
      ops.push(prisma.performance.update({ where: { id: p.id }, data }));
    }
  }

  // Only rows this importer created: admin-entered sets have cuid ids.
  const plannedIds = new Set(plan.performances.map((p) => p.id));
  const orphaned = existing.filter((p) => p.id.startsWith(PERFORMANCE_ID_PREFIX) && !plannedIds.has(p.id));
  console.log(
    `Artists: ${artistsCreated} new, ${artistsUpdated} changed. ` +
      `Performances: ${created} new, ${updated} changed, ${orphaned.length} orphaned.`,
  );

  if (dryRun) {
    console.log("Dry run, nothing written.");
    return;
  }

  // Same 60s budget as import-lotd: Neon's pooled connection blows the 5s default.
  if (ops.length > 0) await prisma.$transaction(ops, { timeout: 60_000 });

  if (orphaned.length > 0) {
    if (prune) {
      await prisma.performance.deleteMany({ where: { id: { in: orphaned.map((p) => p.id) } } });
      console.log(`Pruned ${orphaned.length} sets no longer in the snapshot.`);
    } else {
      console.log(
        `${orphaned.length} imported sets are no longer in the snapshot. ` +
          `Re-run with --prune to remove them: ${orphaned.slice(0, 5).map((p) => p.artistName).join(", ")}`,
      );
    }
  }
  console.log("Done.");
}

async function main() {
  if (flag("fetch")) await runFetch();
  else if (flag("check")) await runCheck();
  else if (flag("sql")) console.log(buildStructureSql((await loadSnapshot()).venues));
  else if (flag("apply")) await runApply({ prune: flag("prune"), dryRun: flag("dry-run") });
  else {
    console.log("Usage: npm run import:lgw -- (--fetch | --check | --sql | --apply [--prune] [--dry-run])");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

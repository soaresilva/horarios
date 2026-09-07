// Importer for the Left of the Dial 2026 schedule.
//
//   npm run import:lotd -- --fetch            network  -> scripts/data/lotd26.json
//   npm run import:lotd -- --apply            snapshot -> Postgres
//   npm run import:lotd -- --apply --prune    also remove sets that vanished
//   npm run import:lotd -- --apply --dry-run  report what would change
//
// Two phases with a committed JSON snapshot between them, for three reasons:
// a Vercel build must never depend on a third-party site being up; a schedule
// change is reviewable as a git diff before it touches any database; and the
// parser tests can run against fixtures with no network at all.
//
// The festival publishes only start times, and its schedule keeps moving
// until October, so this is built to be re-run rather than to be a one-off
// migration.
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { parseActPage, isEditionYear, type ParsedAct } from "../src/lib/lotd-parse";
import { withDerivedEndTimes } from "../src/lib/lotd-endtimes";
import { fromFestivalDayTime, type FestivalTime } from "../src/lib/time";
import { fetchSequentially, politeFetch } from "./lotd/http";
import { applyShowOverrides } from "./lotd/overrides";
import { dateForDay, stageSlugForVenue } from "./lotd/venues";

const FESTIVAL_ID = "lotd26";
const EDITION_YEAR = 2026;
const EDITION_CATEGORY = "past-2026";
const SITE = "https://leftofthedial.nl";
const SNAPSHOT = path.join(process.cwd(), "scripts", "data", "lotd26.json");
const FT: FestivalTime = { timezone: "Europe/Amsterdam", locale: "en-GB" };

interface Snapshot {
  fetchedAt: string;
  edition: number;
  acts: ParsedAct[];
}

const flag = (name: string) => process.argv.includes(`--${name}`);

// --- fetch -----------------------------------------------------------------

/**
 * Every act in this edition, via the WordPress REST API.
 *
 * Enumerating by edition category rather than crawling the sitemap is what
 * keeps last year's acts out: acts-sitemap.xml spans every edition, and a
 * 2025 act page still lists its old day/venue/time headings with no year
 * attached, so it would import cleanly and wrongly.
 */
async function listActSlugs(limit?: number): Promise<{ slug: string; url: string }[]> {
  const categories = JSON.parse(
    await politeFetch(`${SITE}/wp-json/wp/v2/categories?slug=${EDITION_CATEGORY}&_fields=id,count`),
  ) as { id: number; count: number }[];
  if (categories.length === 0) throw new Error(`No "${EDITION_CATEGORY}" category — has the edition tag changed?`);

  const { id, count } = categories[0];
  console.log(`Edition category ${EDITION_CATEGORY} (id ${id}) lists ${count} acts.`);

  const acts: { slug: string; url: string }[] = [];
  for (let page = 1; acts.length < count; page++) {
    const batch = JSON.parse(
      await politeFetch(
        `${SITE}/wp-json/wp/v2/acts?categories=${id}&per_page=100&page=${page}&_fields=slug,link`,
      ),
    ) as { slug: string; link: string }[];
    if (batch.length === 0) break;
    acts.push(...batch.map((a) => ({ slug: a.slug, url: a.link })));
  }
  return limit ? acts.slice(0, limit) : acts;
}

async function runFetch(limit?: number) {
  const listed = await listActSlugs(limit);
  console.log(`Fetching ${listed.length} act pages (sequential, ~400ms apart)...`);

  const acts: ParsedAct[] = [];
  const skipped: string[] = [];

  await fetchSequentially(
    listed.map((a) => a.url),
    (html, url, i) => {
      const { slug } = listed[i];
      // Belt and braces over the category filter: the page itself must also
      // claim this edition.
      if (!isEditionYear(html, EDITION_YEAR)) {
        skipped.push(`${slug} (not tagged ${EDITION_CATEGORY})`);
        return;
      }
      const act = parseActPage(html, slug, url);
      if (!act) {
        skipped.push(`${slug} (no title found)`);
        return;
      }
      acts.push(act);
    },
    (done, total) => {
      if (done % 25 === 0 || done === total) console.log(`  ${done}/${total}`);
    },
  );

  // Applied before every summary/write below, not just once: this importer
  // is built to be re-run right up to the festival (see the header
  // comment), and leftofthedial.nl hasn't corrected the underlying acts —
  // a plain hand-edit of the committed snapshot would be silently
  // clobbered by the next `--fetch`. See scripts/lotd/overrides.ts.
  const corrected = applyShowOverrides(acts);
  const overriddenSlugs = corrected.filter((a, i) => a.shows !== acts[i].shows).map((a) => a.slug);
  if (overriddenSlugs.length) console.log(`Applied known-source-error overrides: ${overriddenSlugs.join(", ")}`);

  const withShows = corrected.filter((a) => a.shows.length > 0);
  const showCount = corrected.reduce((n, a) => n + a.shows.length, 0);
  console.log(
    `Parsed ${corrected.length} acts, ${withShows.length} with a scheduled set, ${showCount} performances.`,
  );
  if (skipped.length) console.log(`Skipped ${skipped.length}: ${skipped.slice(0, 10).join(", ")}`);

  // Fail before writing if any venue is unrecognised, so a renamed room is a
  // loud error rather than a silently missing row.
  const venues = new Set(corrected.flatMap((a) => a.shows.map((s) => s.venue)));
  for (const venue of venues) stageSlugForVenue(venue);
  console.log(`All ${venues.size} venue names map to known rooms.`);

  const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), edition: EDITION_YEAR, acts: corrected };
  await mkdir(path.dirname(SNAPSHOT), { recursive: true });
  await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${SNAPSHOT} — review the diff before applying.`);
}

// --- apply -----------------------------------------------------------------

interface PlannedPerformance {
  id: string;
  artistSlug: string;
  artistName: string;
  stageSlug: string;
  date: string;
  startTime: Date;
  endTime: Date;
}

function planPerformances(acts: ParsedAct[]): PlannedPerformance[] {
  const flattened = acts.flatMap((act) =>
    act.shows.map((show) => {
      const date = dateForDay(show.day);
      const stageSlug = stageSlugForVenue(show.venue);
      return {
        // An act cannot play the same room twice on the same day, so this is
        // unique — and stable across runs, which is what makes re-import an
        // update rather than a duplicate.
        id: `lotd26-p-${act.slug}-${show.day.toLowerCase()}-${stageSlug}`,
        artistSlug: act.slug,
        artistName: act.name,
        stageSlug,
        date,
        startTime: fromFestivalDayTime(date, show.time, FT),
      };
    }),
  );

  const { sets, warnings } = withDerivedEndTimes(flattened);
  for (const warning of warnings) {
    console.warn(`  ! ${warning.stageSlug} ${warning.startTime.toISOString()}: ${warning.message}`);
  }
  return sets;
}

async function runApply({ prune, dryRun }: { prune: boolean; dryRun: boolean }) {
  const snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Snapshot;
  console.log(`Snapshot fetched ${snapshot.fetchedAt}, ${snapshot.acts.length} acts.`);

  const stages = await prisma.stage.findMany({ where: { festivalId: FESTIVAL_ID } });
  const stageIdBySlug = new Map(stages.map((s) => [s.slug, s.id]));

  const planned = planPerformances(snapshot.acts);
  const existingArtists = await prisma.artist.findMany({ where: { festivalId: FESTIVAL_ID } });
  const artistBySlug = new Map(existingArtists.map((a) => [a.slug, a]));

  const existingPerformances = await prisma.performance.findMany({
    where: { stage: { festivalId: FESTIVAL_ID } },
  });
  const performanceById = new Map(existingPerformances.map((p) => [p.id, p]));

  let artistsCreated = 0;
  let artistsUpdated = 0;
  let performancesCreated = 0;
  let performancesUpdated = 0;

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const act of snapshot.acts) {
    const id = `lotd26-a-${act.slug}`;
    const current = artistBySlug.get(act.slug);
    const data = {
      name: act.name,
      country: act.country,
      genres: act.genres,
      spotifyUrl: act.spotifyUrl,
      instagramUrl: act.instagramUrl,
      sourceUrl: act.sourceUrl,
    };

    if (!current) {
      artistsCreated++;
      ops.push(prisma.artist.create({ data: { id, festivalId: FESTIVAL_ID, slug: act.slug, ...data } }));
      continue;
    }
    // Skip no-op updates. A rerun that bumped every updatedAt would
    // invalidate any open /admin tab's staleness snapshots for no reason.
    const unchanged =
      current.name === data.name &&
      current.country === data.country &&
      current.genres === data.genres &&
      current.spotifyUrl === data.spotifyUrl &&
      current.instagramUrl === data.instagramUrl &&
      current.sourceUrl === data.sourceUrl;
    if (!unchanged) {
      artistsUpdated++;
      ops.push(prisma.artist.update({ where: { id: current.id }, data }));
    }
  }

  for (const performance of planned) {
    const stageId = stageIdBySlug.get(performance.stageSlug);
    if (!stageId) throw new Error(`No stage row for slug "${performance.stageSlug}" — run migrations first.`);
    const artistId = `lotd26-a-${performance.artistSlug}`;
    const current = performanceById.get(performance.id);

    // Deliberately does NOT touch `recommended` or `notes`: those are
    // admin-curated, and a re-import must never wipe a curation decision.
    const data = {
      artistName: performance.artistName,
      date: new Date(`${performance.date}T00:00:00Z`),
      startTime: performance.startTime,
      endTime: performance.endTime,
      stageId,
      artistId,
    };

    if (!current) {
      performancesCreated++;
      ops.push(prisma.performance.create({ data: { id: performance.id, ...data } }));
      continue;
    }
    const unchanged =
      current.artistName === data.artistName &&
      current.date.toISOString() === data.date.toISOString() &&
      current.startTime.getTime() === data.startTime.getTime() &&
      current.endTime.getTime() === data.endTime.getTime() &&
      current.stageId === data.stageId &&
      current.artistId === data.artistId;
    if (!unchanged) {
      performancesUpdated++;
      ops.push(prisma.performance.update({ where: { id: performance.id }, data }));
    }
  }

  // Only ever considers rows this importer created: admin-entered sets have
  // cuid ids and can never match the prefix.
  const plannedIds = new Set(planned.map((p) => p.id));
  const orphaned = existingPerformances.filter(
    (p) => p.id.startsWith("lotd26-p-") && !plannedIds.has(p.id),
  );

  console.log(
    `Artists: ${artistsCreated} new, ${artistsUpdated} changed. ` +
      `Performances: ${performancesCreated} new, ${performancesUpdated} changed, ${orphaned.length} orphaned.`,
  );

  if (dryRun) {
    console.log("Dry run — nothing written.");
    return;
  }

  // Prisma's default batch-transaction timeout is 5s, tuned for the small
  // admin bulk-saves elsewhere in this app (tens of rows on a local or
  // low-latency connection). A full import is ~500 ops, and over Neon's
  // pooled connection that alone exceeds 5s before any work is done — it
  // failed exactly this way against production on the first run. A failed
  // batch transaction rolls back cleanly (verified: 0 rows written that
  // time), so this is a performance fix, not a safety one.
  if (ops.length > 0) await prisma.$transaction(ops, { timeout: 60_000 });

  if (orphaned.length > 0) {
    if (prune) {
      await prisma.performance.deleteMany({ where: { id: { in: orphaned.map((p) => p.id) } } });
      console.log(`Pruned ${orphaned.length} sets no longer in the source.`);
    } else {
      console.log(
        `${orphaned.length} imported sets are no longer in the source. ` +
          `Re-run with --prune to remove them: ${orphaned.slice(0, 5).map((p) => p.artistName).join(", ")}`,
      );
    }
  }

  console.log("Done.");
}

// --- main ------------------------------------------------------------------

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  if (flag("fetch")) await runFetch(limit);
  else if (flag("apply")) await runApply({ prune: flag("prune"), dryRun: flag("dry-run") });
  else {
    console.log("Usage: npm run import:lotd -- (--fetch [--limit=N] | --apply [--prune] [--dry-run])");
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

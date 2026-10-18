// Importer for London Calling October 2026 (Paradiso Amsterdam + De Kring +
// Barlaeus, Fri 30 / Sat 31 October).
//
//   npm run import:lc -- --check            validate the snapshot, no network, no DB
//   npm run import:lc -- --fetch-artists    londoncalling.nl -> snapshot `artists`
//   npm run import:lc -- --apply --dry-run  report what would change
//   npm run import:lc -- --apply            snapshot -> Postgres
//   npm run import:lc -- --apply --prune    also remove sets that vanished
//
// The festival publishes its timetable only as two JPG posters, so
// scripts/data/lc26oct.json is hand-transcribed (committed, reviewable as a
// diff) and checked against the posters' pixels by
// scripts/lc/measure-poster.py. This script never reads the posters.
// Rows are `lc26oct-p-*` / `lc26oct-a-*`, so --prune never touches
// admin-entered (cuid) rows or any other festival.
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { fetchSequentially, politeFetch } from "./lotd/http";
import {
  decodeEntities,
  extractSpotifyArtist,
  LC_ARTIST_PREFIX,
  LC_FESTIVAL_ID,
  LC_ID_PREFIX,
  LC_SITE,
  planLc,
  spotifyMatches,
  validateLcSnapshot,
  type LcArtist,
  type LcSnapshot,
} from "./lc/plan";

const SNAPSHOT = path.join(process.cwd(), "scripts", "data", "lc26oct.json");

const flag = (name: string) => process.argv.includes(`--${name}`);

async function readSnapshot(): Promise<LcSnapshot> {
  return JSON.parse(await readFile(SNAPSHOT, "utf8")) as LcSnapshot;
}

async function loadSnapshot(): Promise<LcSnapshot> {
  const snapshot = await readSnapshot();
  const errors = validateLcSnapshot(snapshot);
  if (errors.length) throw new Error(`Snapshot failed validation:\n  ${errors.join("\n  ")}`);
  const bands = snapshot.sets.filter((s) => s.kind === "band").length;
  console.log(
    `Snapshot ${snapshot.transcribedAt}: ${bands} band sets + ${snapshot.sets.length - bands} club nights, ` +
      `${snapshot.artists.length} artist pages; per-room counts match the posters.`,
  );
  return snapshot;
}

// --- fetch-artists -----------------------------------------------------------

async function runFetchArtists() {
  const snapshot = await readSnapshot();
  const wanted = [...new Set(snapshot.sets.flatMap((s) => (s.artistSlug ? [s.artistSlug] : [])))];

  // The artists endpoint spans every edition (~270 posts), three requests in
  // all, rather than one ?slug= request per act.
  const listed = new Map<string, { title: string; link: string }>();
  for (let page = 1; ; page++) {
    const batch = JSON.parse(
      await politeFetch(`${LC_SITE}/wp-json/wp/v2/artists?per_page=100&page=${page}&_fields=slug,title,link`),
    ) as { slug: string; title: { rendered: string }; link: string }[];
    for (const a of batch) listed.set(a.slug, { title: decodeEntities(a.title.rendered), link: a.link });
    if (batch.length < 100) break;
  }

  const missing = wanted.filter((slug) => !listed.has(slug));
  if (missing.length) throw new Error(`No artist page for: ${missing.join(", ")}`);

  console.log(`Fetching ${wanted.length} artist pages for Spotify links (sequential, ~400ms apart)...`);
  const artists: LcArtist[] = await fetchSequentially(
    wanted.map((slug) => listed.get(slug)!.link),
    (html, url, i) => ({
      slug: wanted[i],
      name: listed.get(wanted[i])!.title,
      sourceUrl: url,
      spotifyUrl: extractSpotifyArtist(html),
    }),
  );

  // Ask Spotify who each embedded artist actually is, and drop any link
  // that names a different act (see spotifyMatches).
  const linked = artists.filter((a) => a.spotifyUrl);
  console.log(`Verifying ${linked.length} Spotify links against Spotify's own artist names...`);
  const titles = await fetchSequentially(
    linked.map((a) => `https://open.spotify.com/oembed?url=${encodeURIComponent(a.spotifyUrl!)}`),
    (json) => (JSON.parse(json) as { title: string }).title,
  );
  linked.forEach((a, i) => {
    if (spotifyMatches(titles[i], a.name)) return;
    console.warn(`  Dropping ${a.name}'s Spotify link: the festival page embeds "${titles[i]}" (${a.spotifyUrl}).`);
    a.spotifyUrl = null;
  });

  const updated: LcSnapshot = { ...snapshot, artists };
  const errors = validateLcSnapshot(updated);
  if (errors.length) throw new Error(`Fetched artists don't match the snapshot:\n  ${errors.join("\n  ")}`);
  await writeFile(SNAPSHOT, `${JSON.stringify(updated, null, 2)}\n`);
  const withSpotify = artists.filter((a) => a.spotifyUrl).length;
  console.log(`Wrote ${artists.length} artists (${withSpotify} with Spotify) to ${path.relative(process.cwd(), SNAPSHOT)}.`);
}

// --- apply -------------------------------------------------------------------

async function runApply({ prune, dryRun }: { prune: boolean; dryRun: boolean }) {
  const snapshot = await loadSnapshot();

  const [stages, existingArtists, existing] = await Promise.all([
    prisma.stage.findMany({ where: { festivalId: LC_FESTIVAL_ID } }),
    prisma.artist.findMany({ where: { festivalId: LC_FESTIVAL_ID } }),
    prisma.performance.findMany({ where: { stage: { festivalId: LC_FESTIVAL_ID } } }),
  ]);
  if (stages.length === 0) throw new Error(`No stages for festival "${LC_FESTIVAL_ID}" — run migrations first.`);
  const stageIdBySlug = new Map(stages.map((s) => [s.slug, s.id]));
  const artistById = new Map(existingArtists.map((a) => [a.id, a]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let artistsCreated = 0;
  let artistsUpdated = 0;

  for (const a of snapshot.artists) {
    const id = `${LC_ARTIST_PREFIX}${a.slug}`;
    const data = { name: a.name, spotifyUrl: a.spotifyUrl, sourceUrl: a.sourceUrl };
    const current = artistById.get(id);
    if (!current) {
      artistsCreated++;
      ops.push(prisma.artist.create({ data: { id, festivalId: LC_FESTIVAL_ID, slug: a.slug, ...data } }));
    } else if (
      current.name !== data.name ||
      current.spotifyUrl !== data.spotifyUrl ||
      current.sourceUrl !== data.sourceUrl
    ) {
      artistsUpdated++;
      ops.push(prisma.artist.update({ where: { id }, data }));
    }
  }

  const planned = planLc(snapshot);
  const ids = new Set(planned.map((p) => p.id));
  const byId = new Map(existing.map((p) => [p.id, p]));
  let created = 0;
  let updated = 0;

  for (const p of planned) {
    const stageId = stageIdBySlug.get(p.stageSlug);
    if (!stageId) throw new Error(`No stage row for slug "${p.stageSlug}" — run migrations first.`);
    // Never touches `recommended` or `notes` (admin curation), same as the
    // LOTD and TOUO importers.
    const data = {
      artistName: p.artistName,
      date: new Date(`${p.date}T00:00:00Z`),
      startTime: p.startTime,
      endTime: p.endTime,
      stageId,
      artistId: p.artistId,
    };
    const current = byId.get(p.id);
    if (!current) {
      created++;
      ops.push(prisma.performance.create({ data: { id: p.id, ...data } }));
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
      updated++;
      ops.push(prisma.performance.update({ where: { id: p.id }, data }));
    }
  }

  const orphaned = existing.filter((p) => p.id.startsWith(LC_ID_PREFIX) && !ids.has(p.id));
  console.log(`Artists: ${artistsCreated} new, ${artistsUpdated} changed.`);
  console.log(`Performances: ${created} new, ${updated} changed, ${orphaned.length} orphaned.`);

  if (dryRun) {
    console.log("Dry run — nothing written.");
    return;
  }

  // Same 60s budget as the other importers: Neon's pooled connection blows the 5s default.
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
  if (flag("check")) await loadSnapshot();
  else if (flag("fetch-artists")) await runFetchArtists();
  else if (flag("apply")) await runApply({ prune: flag("prune"), dryRun: flag("dry-run") });
  else {
    console.log("Usage: npm run import:lc -- (--check | --fetch-artists | --apply [--prune] [--dry-run])");
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

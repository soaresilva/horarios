// Importer for Primavera Sound Barcelona 2027 (Parc del Fòrum, 2-6 June 2027).
//
//   npm run import:ps -- --check            validate the snapshot, no network, no DB
//   npm run import:ps -- --fetch-artists    primaverasound.com -> snapshot `artists`
//   npm run import:ps -- --apply --dry-run  report what would change
//   npm run import:ps -- --apply            snapshot -> Postgres
//   npm run import:ps -- --apply --prune    also remove sets that vanished
//
// scripts/data/ps27.json is a hand-made GUESS (only the day split is real), so
// the festival row starts unpublished. See scripts/ps/plan.ts for what's
// checked and scripts/ps/eval.ts for how the guess is scored.
// Rows are `ps27-p-*`, so --prune never touches admin-entered (cuid) rows or
// any other festival.
import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { politeFetch } from "./lotd/http";
import {
  artistSlugCandidates,
  artistUrl,
  PS_ARTIST_PREFIX,
  PS_FESTIVAL_ID,
  PS_ID_PREFIX,
  pageTitleAct,
  planPs,
  sameAct,
  validatePsSnapshot,
  type PsArtist,
  type PsSnapshot,
} from "./ps/plan";

const SNAPSHOT = path.join(process.cwd(), "scripts", "data", "ps27.json");

const flag = (name: string) => process.argv.includes(`--${name}`);

async function readSnapshot(): Promise<PsSnapshot> {
  return JSON.parse(await readFile(SNAPSHOT, "utf8")) as PsSnapshot;
}

// --- fetch-artists -----------------------------------------------------------
// primaverasound.com's robots.txt only disallows /login, /wishlist and
// /checkout. Its artist sitemap lags the lineup (Robyn, Napa and others
// aren't in it yet), so the page itself is asked instead: a slug is right
// only if its <title> names the same act.

async function runFetchArtists() {
  const snapshot = await readSnapshot();
  const acts = snapshot.sets.filter((s) => s.day !== "SUN");
  console.log(`Fetching ${acts.length} artist pages (sequential, ~400ms apart)...`);

  const artists = new Map<string, PsArtist>();
  const failures: string[] = [];
  for (const set of acts) {
    const tried: string[] = [];
    let found: PsArtist | null = null;
    for (const slug of artistSlugCandidates(set.name)) {
      const html = await politeFetch(artistUrl(slug)).catch(() => null);
      const title = html && pageTitleAct(html);
      if (title && sameAct(title, set.name)) {
        found = { slug, name: title, sourceUrl: artistUrl(slug) };
        break;
      }
      tried.push(`${slug} (${title ?? "no page"})`);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    if (found) {
      set.artistSlug = found.slug;
      artists.set(found.slug, found);
    } else {
      delete set.artistSlug;
      failures.push(`${set.name}: ${tried.join(", ")}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  if (failures.length) {
    console.warn(`No page found for ${failures.length} acts (add a SLUG_OVERRIDES entry in scripts/ps/plan.ts):\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const updated: PsSnapshot = { ...snapshot, artists: [...artists.values()] };
  const errors = validatePsSnapshot(updated);
  if (errors.length) throw new Error(`Fetched artists don't match the snapshot:\n  ${errors.join("\n  ")}`);
  await writeFile(SNAPSHOT, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Wrote ${artists.size} artists to ${path.relative(process.cwd(), SNAPSHOT)}.`);
}

async function loadSnapshot(): Promise<PsSnapshot> {
  const snapshot = await readSnapshot();
  const errors = validatePsSnapshot(snapshot);
  if (errors.length) throw new Error(`Snapshot failed validation:\n  ${errors.join("\n  ")}`);
  console.log(
    `Snapshot ${snapshot.generatedAt}: ${snapshot.sets.length} sets, every poster act placed once, ${snapshot.artists.length} artist pages.`,
  );
  return snapshot;
}

async function runApply({ prune, dryRun }: { prune: boolean; dryRun: boolean }) {
  const snapshot = await loadSnapshot();

  const [stages, existingArtists, existing] = await Promise.all([
    prisma.stage.findMany({ where: { festivalId: PS_FESTIVAL_ID } }),
    prisma.artist.findMany({ where: { festivalId: PS_FESTIVAL_ID } }),
    prisma.performance.findMany({ where: { stage: { festivalId: PS_FESTIVAL_ID } } }),
  ]);
  if (stages.length === 0) throw new Error(`No stages for festival "${PS_FESTIVAL_ID}" — run migrations first.`);
  const stageIdBySlug = new Map(stages.map((s) => [s.slug, s.id]));

  const artistById = new Map(existingArtists.map((a) => [a.id, a]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let artistsCreated = 0;
  let artistsUpdated = 0;

  for (const a of snapshot.artists) {
    const id = `${PS_ARTIST_PREFIX}${a.slug}`;
    const data = { name: a.name, sourceUrl: a.sourceUrl };
    const current = artistById.get(id);
    if (!current) {
      artistsCreated++;
      ops.push(prisma.artist.create({ data: { id, festivalId: PS_FESTIVAL_ID, slug: a.slug, ...data } }));
    } else if (current.name !== data.name || current.sourceUrl !== data.sourceUrl) {
      artistsUpdated++;
      ops.push(prisma.artist.update({ where: { id }, data }));
    }
  }

  const planned = planPs(snapshot);
  const ids = new Set(planned.map((p) => p.id));
  const byId = new Map(existing.map((p) => [p.id, p]));
  let created = 0;
  let updated = 0;

  for (const p of planned) {
    const stageId = stageIdBySlug.get(p.stageSlug);
    if (!stageId) throw new Error(`No stage row for slug "${p.stageSlug}" — run migrations first.`);
    // Never touches `recommended` or `notes` (admin curation), same as the
    // other importers.
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

  const orphaned = existing.filter((p) => p.id.startsWith(PS_ID_PREFIX) && !ids.has(p.id));
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
    console.log("Usage: npm run import:ps -- (--check | --fetch-artists | --apply [--prune] [--dry-run])");
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

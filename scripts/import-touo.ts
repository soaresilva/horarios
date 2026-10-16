// Importer for The Official Unofficial 2026, LOTD's free daytime side
// programme (Fri 23 / Sat 24 October, 12:00-16:00).
//
//   npm run import:touo -- --check            validate the snapshot, no DB
//   npm run import:touo -- --apply --dry-run  report what would change
//   npm run import:touo -- --apply            snapshot -> Postgres
//   npm run import:touo -- --apply --prune    also remove sets that vanished
//
// The only source is a one-page PDF. scripts/touo/extract-pdf.py turns it
// into scripts/data/touo26.json (committed, reviewable as a diff); this
// script only ever reads that snapshot. Rows are `touo26-p-*`, so
// `import:lotd --prune` and this script's `--prune` never touch each other's
// sets, and both leave admin-entered (cuid) rows alone.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  checkAgainstMainProgramme,
  findOverlaps,
  planTouo,
  TOUO_ID_PREFIX,
  validateTouoSnapshot,
  type TouoSnapshot,
} from "./touo/plan";

const FESTIVAL_ID = "lotd26";
const SNAPSHOT = path.join(process.cwd(), "scripts", "data", "touo26.json");

const flag = (name: string) => process.argv.includes(`--${name}`);

async function loadSnapshot(): Promise<TouoSnapshot> {
  const snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8")) as TouoSnapshot;
  const errors = validateTouoSnapshot(snapshot.sets);
  if (errors.length) {
    throw new Error(`Snapshot failed validation:\n  ${errors.join("\n  ")}`);
  }
  const bands = snapshot.sets.filter((s) => s.kind === "band").length;
  console.log(
    `Snapshot ${snapshot.fetchedAt}: ${bands} band sets + ${snapshot.sets.length - bands} extras, ` +
      `per-room counts match the PDF.`,
  );
  return snapshot;
}

async function runApply({ prune, dryRun }: { prune: boolean; dryRun: boolean }) {
  const snapshot = await loadSnapshot();

  const [stages, artists, existing] = await Promise.all([
    prisma.stage.findMany({ where: { festivalId: FESTIVAL_ID } }),
    prisma.artist.findMany({ where: { festivalId: FESTIVAL_ID }, select: { id: true, name: true } }),
    prisma.performance.findMany({ where: { stage: { festivalId: FESTIVAL_ID } } }),
  ]);
  const stageIdBySlug = new Map(stages.map((s) => [s.slug, s.id]));

  const planned = planTouo(snapshot.sets, artists);

  const ids = new Set<string>();
  for (const p of planned) {
    if (ids.has(p.id)) throw new Error(`Duplicate planned id ${p.id}.`);
    ids.add(p.id);
  }

  const linked = planned.filter((p) => p.artistId).length;
  console.log(`Linked ${linked} sets to LOTD artists; ${planned.length - linked} are TOUO-only.`);

  const touoSlots = planned.map((p) => {
    const stageId = stageIdBySlug.get(p.stageSlug);
    if (!stageId) throw new Error(`No stage row for slug "${p.stageSlug}" — run migrations first.`);
    return { id: p.id, label: `${p.artistName} (TOUO)`, stageKey: stageId, startTime: p.startTime, endTime: p.endTime };
  });
  // Rotown, Uniek, V11, the TR halls and friends carry LOTD sets on the
  // same days, so TOUO sets are checked against the main programme too.
  const mainSlots = existing
    .filter((p) => !p.id.startsWith(TOUO_ID_PREFIX))
    .map((p) => ({ id: p.id, label: p.artistName, stageKey: p.stageId, startTime: p.startTime, endTime: p.endTime }));
  const { clashes, clips } = checkAgainstMainProgramme(mainSlots, touoSlots);
  const allClashes = [...findOverlaps(touoSlots), ...clashes];
  if (allClashes.length) throw new Error(`Overlapping sets:\n  ${allClashes.join("\n  ")}`);

  const byId = new Map(existing.map((p) => [p.id, p]));
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let created = 0;
  let updated = 0;

  for (const p of planned) {
    // Never touches `recommended` or `notes` (admin curation), same as
    // scripts/import-lotd.ts.
    const data = {
      artistName: p.artistName,
      date: new Date(`${p.date}T00:00:00Z`),
      startTime: p.startTime,
      endTime: p.endTime,
      stageId: stageIdBySlug.get(p.stageSlug)!,
      artistId: p.artistId,
      series: p.series,
      host: p.host,
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
      current.artistId === data.artistId &&
      current.series === data.series &&
      current.host === data.host;
    if (!unchanged) {
      updated++;
      ops.push(prisma.performance.update({ where: { id: p.id }, data }));
    }
  }

  for (const clip of clips) {
    const current = byId.get(clip.id)!;
    if (current.endTime.getTime() === clip.endTime.getTime()) continue;
    console.log(`  Clipping LOTD estimated end: ${clip.label} now ends at the TOUO set that follows it.`);
    ops.push(prisma.performance.update({ where: { id: clip.id }, data: { endTime: clip.endTime } }));
  }

  const orphaned = existing.filter((p) => p.id.startsWith(TOUO_ID_PREFIX) && !ids.has(p.id));
  console.log(`Performances: ${created} new, ${updated} changed, ${orphaned.length} orphaned.`);

  if (dryRun) {
    console.log("Dry run — nothing written.");
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
        `${orphaned.length} imported TOUO sets are no longer in the snapshot. ` +
          `Re-run with --prune to remove them: ${orphaned.slice(0, 5).map((p) => p.artistName).join(", ")}`,
      );
    }
  }
  console.log("Done.");
}

async function main() {
  if (flag("check")) await loadSnapshot();
  else if (flag("apply")) await runApply({ prune: flag("prune"), dryRun: flag("dry-run") });
  else {
    console.log("Usage: npm run import:touo -- (--check | --apply [--prune] [--dry-run])");
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

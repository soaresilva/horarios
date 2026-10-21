"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateVisitorId, getVisitorId, setVisitorId } from "@/lib/visitor";
import { generateCode, isExpired, PAIRING_CODE_TTL_MS } from "@/lib/pairing-code";
import { mergeMarks } from "@/lib/marks-merge";
import { clampMarksPayload, marksPayloadSchema, type IncomingMarksPayload, type MarksPayload } from "@/lib/marks";
import { actKeyOf } from "@/lib/shows";
import type { MarkTier as PrismaMarkTier } from "@/generated/prisma/client";

// Every action here scopes performance ids to one festival via
// stage.festivalId, the same defensive pattern saveScheduleAction uses in
// src/app/admin/actions.ts — a stale/tampered id from a different festival
// (or a plain junk string) is silently dropped rather than trusted.
async function validPerformanceIdsForFestival(festivalId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.performance.findMany({
    where: { id: { in: ids }, stage: { festivalId } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Same defence for hidden acts: a key only counts if some performance in
// this festival actually groups under it (actKeyOf, the same grouping the
// client hid it by). Loads the festival's performances, so it's skipped
// entirely for the common case of nothing hidden.
async function validActKeysForFestival(festivalId: string, keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  const rows = await prisma.performance.findMany({
    where: { stage: { festivalId } },
    select: { artistId: true, artistName: true },
  });
  const present = new Set(rows.map(actKeyOf));
  return Array.from(new Set(keys.filter((key) => present.has(key))));
}

async function hiddenActsFor(visitorId: string, festivalId: string): Promise<string[]> {
  const rows = await prisma.hiddenAct.findMany({
    where: { visitorId, festivalId },
    select: { actKey: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.actKey);
}

async function requireFestival(festivalSlug: string) {
  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug } });
  if (!festival) throw new Error(`Unknown festival: ${festivalSlug}`);
  return festival;
}

// Every id this payload references — an id can carry a tier, a note, or
// both, so the union (not just mustSee ∪ interested) is what needs
// validating and what a sync's delete-set has to spare.
function unionOf(payload: Omit<MarksPayload, "hidden">): string[] {
  return Array.from(new Set([...payload.mustSee, ...payload.interested, ...Object.keys(payload.notes)]));
}

// Drops any id that isn't a real performance in this festival, from every
// part of the payload at once (tiers and notes alike) — a junk id in a note
// is exactly as untrusted as one in mustSee.
// `hidden` passes through as undefined when the client didn't send it (see
// IncomingMarksPayload), so callers can still tell "absent" from "empty".
async function filterPayloadToValidIds(festivalId: string, payload: IncomingMarksPayload): Promise<IncomingMarksPayload> {
  const [validIdList, hidden] = await Promise.all([
    validPerformanceIdsForFestival(festivalId, unionOf(payload)),
    payload.hidden === undefined ? undefined : validActKeysForFestival(festivalId, payload.hidden),
  ]);
  const validIds = new Set(validIdList);
  const notes: Record<string, string> = {};
  for (const [id, note] of Object.entries(payload.notes)) {
    if (validIds.has(id)) notes[id] = note;
  }
  return {
    mustSee: payload.mustSee.filter((id) => validIds.has(id)),
    interested: payload.interested.filter((id) => validIds.has(id)),
    notes,
    hidden,
  };
}

function tierColumnFor(payload: Omit<MarksPayload, "hidden">, performanceId: string): PrismaMarkTier | null {
  if (payload.mustSee.includes(performanceId)) return "MUST_SEE";
  if (payload.interested.includes(performanceId)) return "INTERESTED";
  return null;
}

async function marksFor(visitorId: string, festivalId: string): Promise<MarksPayload> {
  const [rows, hidden] = await Promise.all([
    prisma.favorite.findMany({
      where: { visitorId, performance: { stage: { festivalId } } },
      select: { performanceId: true, tier: true, note: true },
    }),
    hiddenActsFor(visitorId, festivalId),
  ]);
  const mustSee: string[] = [];
  const interested: string[] = [];
  const notes: Record<string, string> = {};
  for (const row of rows) {
    if (row.tier === "MUST_SEE") mustSee.push(row.performanceId);
    else if (row.tier === "INTERESTED") interested.push(row.performanceId);
    if (row.note) notes[row.performanceId] = row.note;
  }
  return { mustSee, interested, notes, hidden };
}

// First-time opt-in: mints the visitor cookie (if not already set) and seeds
// the server with whatever this device already had marked in localStorage.
// Never called implicitly — only from the visitor tapping "sync" in
// SyncFavoritesPanel, so a visitor who never opts in gets no cookie and no
// Favorite rows, ever.
export async function optIntoSync(festivalSlug: string, localMarks: IncomingMarksPayload): Promise<{ visitorId: string }> {
  const parsed = clampMarksPayload(marksPayloadSchema.parse(localMarks));
  const festival = await requireFestival(festivalSlug);
  const visitorId = await getOrCreateVisitorId();
  const valid = await filterPayloadToValidIds(festival.id, parsed);
  const unionIds = unionOf(valid);

  if (unionIds.length > 0) {
    await prisma.favorite.createMany({
      data: unionIds.map((performanceId) => ({
        visitorId,
        performanceId,
        tier: tierColumnFor(valid, performanceId),
        note: valid.notes[performanceId] ?? null,
      })),
      skipDuplicates: true,
    });
  }
  if (valid.hidden && valid.hidden.length > 0) {
    await prisma.hiddenAct.createMany({
      data: valid.hidden.map((actKey) => ({ visitorId, festivalId: festival.id, actKey })),
      skipDuplicates: true,
    });
  }

  return { visitorId };
}

// null = not opted into sync yet (distinct from "opted in, zero marks"), so
// useFavoritesSync knows to leave localStorage as the sole source of truth.
export async function listMarks(festivalSlug: string): Promise<MarksPayload | null> {
  const visitorId = await getVisitorId();
  if (!visitorId) return null;
  const festival = await requireFestival(festivalSlug);
  return marksFor(visitorId, festival.id);
}

// Full-payload replace, not incremental — the whole point of "last write
// wins" steady-state sync (see useFavoritesSync.ts) is that unmarking (or
// erasing a note) propagates, which a pure union/add-only sync could never
// represent. The delete set is `notIn` the union of every id the payload
// still references (a tier, a note, or both) — so pushing a tier change can
// never delete a row that's only there to carry a note, and vice versa.
// Surviving/new rows go through `upsert`: simpler and just as correct as a
// createMany+updateMany split, since it can't miss updating a row that
// already existed with a different tier or note.
//
// Hidden acts follow the same full-replace rule, but only when the payload
// carries a `hidden` list at all: a tab still on pre-hiding JS omits it, and
// must not wipe hides made on another device (IncomingMarksPayload).
export async function syncMarks(
  festivalSlug: string,
  localMarks: IncomingMarksPayload,
): Promise<{ server: MarksPayload }> {
  const parsed = clampMarksPayload(marksPayloadSchema.parse(localMarks));
  const festival = await requireFestival(festivalSlug);
  // Self-healing: the client only calls this once it believes it's synced,
  // but if its cookie was ever cleared, treat this call as a fresh opt-in
  // rather than throwing.
  const visitorId = await getOrCreateVisitorId();
  const valid = await filterPayloadToValidIds(festival.id, parsed);
  const unionIds = unionOf(valid);

  await prisma.$transaction([
    prisma.favorite.deleteMany({
      where: {
        visitorId,
        performanceId: { notIn: unionIds },
        performance: { stage: { festivalId: festival.id } },
      },
    }),
    ...unionIds.map((performanceId) => {
      const tier = tierColumnFor(valid, performanceId);
      const note = valid.notes[performanceId] ?? null;
      return prisma.favorite.upsert({
        where: { visitorId_performanceId: { visitorId, performanceId } },
        create: { visitorId, performanceId, tier, note },
        update: { tier, note },
      });
    }),
    ...(valid.hidden === undefined
      ? []
      : [
          prisma.hiddenAct.deleteMany({
            where: { visitorId, festivalId: festival.id, actKey: { notIn: valid.hidden } },
          }),
          prisma.hiddenAct.createMany({
            data: valid.hidden.map((actKey) => ({ visitorId, festivalId: festival.id, actKey })),
            skipDuplicates: true,
          }),
        ]),
  ]);

  const hidden = valid.hidden ?? (await hiddenActsFor(visitorId, festival.id));
  return { server: { ...valid, hidden } };
}

export async function generatePairingCode(): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const visitorId = await getVisitorId();
  if (!visitorId) return { error: "Turn on sync before generating a code." };

  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

  // Collisions are astronomically unlikely at 1e6 codes with a 10-minute
  // window, but the `code` column is @unique, so a retry loop is the cheap
  // way to handle one instead of trusting probability alone.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.pairingCode.create({ data: { code, visitorId, expiresAt } });
      return { code, expiresAt: expiresAt.toISOString() };
    } catch (err) {
      const isUniqueViolation = typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
      if (!isUniqueViolation) throw err;
    }
  }
  return { error: "Could not generate a code, try again." };
}

export async function redeemPairingCode(
  code: string,
  festivalSlug: string,
  localMarks: IncomingMarksPayload,
): Promise<MarksPayload | { error: "invalid" | "expired" }> {
  const parsed = clampMarksPayload(marksPayloadSchema.parse(localMarks));
  const festival = await requireFestival(festivalSlug);
  const record = await prisma.pairingCode.findUnique({ where: { code } });
  if (!record) return { error: "invalid" };
  if (isExpired(record)) return { error: "expired" };

  // Atomic single-use claim: guards the race where two redemptions of the
  // same code land concurrently. If this updates zero rows, someone else
  // (or the clock) beat us to it between the read above and here.
  const claim = await prisma.pairingCode.updateMany({
    where: { code, redeemedAt: null, expiresAt: { gt: new Date() } },
    data: { redeemedAt: new Date() },
  });
  if (claim.count === 0) return { error: "invalid" };

  const targetVisitorId = record.visitorId;
  const [serverMarks, validLocalMarks] = await Promise.all([
    marksFor(targetVisitorId, festival.id),
    filterPayloadToValidIds(festival.id, parsed),
  ]);
  const merged = mergeMarks(serverMarks, { ...validLocalMarks, hidden: validLocalMarks.hidden ?? [] });
  const unionIds = unionOf(merged);

  await prisma.$transaction(
    unionIds.map((performanceId) => {
      const tier = tierColumnFor(merged, performanceId);
      const note = merged.notes[performanceId] ?? null;
      return prisma.favorite.upsert({
        where: { visitorId_performanceId: { visitorId: targetVisitorId, performanceId } },
        create: { visitorId: targetVisitorId, performanceId, tier, note },
        update: { tier, note },
      });
    }),
  );
  if (merged.hidden.length > 0) {
    await prisma.hiddenAct.createMany({
      data: merged.hidden.map((actKey) => ({ visitorId: targetVisitorId, festivalId: festival.id, actKey })),
      skipDuplicates: true,
    });
  }

  // The redeeming device adopts the generating device's identity — pairing
  // is symmetric and permanent (no "unpair"), see the plan doc for why this
  // was chosen over a separate Visitor group table.
  await setVisitorId(targetVisitorId);

  return merged;
}

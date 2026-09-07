"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateVisitorId, getVisitorId, setVisitorId } from "@/lib/visitor";
import { generateCode, isExpired, PAIRING_CODE_TTL_MS } from "@/lib/pairing-code";
import { mergeFavoriteIds } from "@/lib/favorites-merge";

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

async function requireFestival(festivalSlug: string) {
  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug } });
  if (!festival) throw new Error(`Unknown festival: ${festivalSlug}`);
  return festival;
}

async function favoriteIdsFor(visitorId: string, festivalId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({
    where: { visitorId, performance: { stage: { festivalId } } },
    select: { performanceId: true },
  });
  return rows.map((r) => r.performanceId);
}

// First-time opt-in: mints the visitor cookie (if not already set) and seeds
// the server with whatever this device already had starred in localStorage.
// Never called implicitly — only from the visitor tapping "sync" in
// SyncFavoritesPanel, so a visitor who never opts in gets no cookie and no
// Favorite rows, ever.
export async function optIntoSync(festivalSlug: string, localIds: string[]): Promise<{ visitorId: string }> {
  const festival = await requireFestival(festivalSlug);
  const visitorId = await getOrCreateVisitorId();
  const validIds = await validPerformanceIdsForFestival(festival.id, localIds);

  if (validIds.length > 0) {
    await prisma.favorite.createMany({
      data: validIds.map((performanceId) => ({ visitorId, performanceId })),
      skipDuplicates: true,
    });
  }

  return { visitorId };
}

// null = not opted into sync yet (distinct from "opted in, zero favorites"),
// so useFavoritesSync knows to leave localStorage as the sole source of truth.
export async function listFavorites(festivalSlug: string): Promise<string[] | null> {
  const visitorId = await getVisitorId();
  if (!visitorId) return null;
  const festival = await requireFestival(festivalSlug);
  return favoriteIdsFor(visitorId, festival.id);
}

// Full-array replace, not incremental — the whole point of "last write wins"
// steady-state sync (see useFavoritesSync.ts) is that unstarring propagates,
// which a pure union/add-only sync could never represent.
export async function syncFavorites(festivalSlug: string, localIds: string[]): Promise<{ serverIds: string[] }> {
  const festival = await requireFestival(festivalSlug);
  // Self-healing: the client only calls this once it believes it's synced,
  // but if its cookie was ever cleared, treat this call as a fresh opt-in
  // rather than throwing.
  const visitorId = await getOrCreateVisitorId();
  const validIds = await validPerformanceIdsForFestival(festival.id, localIds);

  await prisma.$transaction([
    prisma.favorite.deleteMany({
      where: {
        visitorId,
        performanceId: { notIn: validIds },
        performance: { stage: { festivalId: festival.id } },
      },
    }),
    prisma.favorite.createMany({
      data: validIds.map((performanceId) => ({ visitorId, performanceId })),
      skipDuplicates: true,
    }),
  ]);

  return { serverIds: validIds };
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
  localIds: string[],
): Promise<{ favoriteIds: string[] } | { error: "invalid" | "expired" }> {
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
  const [serverIds, validLocalIds] = await Promise.all([
    favoriteIdsFor(targetVisitorId, festival.id),
    validPerformanceIdsForFestival(festival.id, localIds),
  ]);
  const merged = mergeFavoriteIds(serverIds, validLocalIds);

  await prisma.favorite.createMany({
    data: merged.map((performanceId) => ({ visitorId: targetVisitorId, performanceId })),
    skipDuplicates: true,
  });

  // The redeeming device adopts the generating device's identity — pairing
  // is symmetric and permanent (no "unpair"), see the plan doc for why this
  // was chosen over a separate Visitor group table.
  await setVisitorId(targetVisitorId);

  return { favoriteIds: merged };
}

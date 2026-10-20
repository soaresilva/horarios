"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateVisitorId, getVisitorId } from "@/lib/visitor";
import { crewsEnabled } from "@/lib/festival-copy";
import { CREW_MAX_MEMBERS, generateCrewCode, nextColorIndex, normalizeCrewCode, parseTag, toCrewDTO } from "@/lib/crew";
import type { CrewDTO, CrewResult } from "@/types/crew";

// Crews: a few visitors who can read each other's Favorite rows. The code is
// the credential (see the Crew model in prisma/schema.prisma). Every write
// is gated on the festival having crews switched on (src/lib/festival-copy.ts)
// so a stale client on a festival that's off can't create data there.
//
// Joining a crew never touches Favorite rows itself: the client turns on
// favorites sync for the festival straight after (useFavoritesSync), which
// is what puts its marks where crewmates can read them.

const slugSchema = z.string().min(1).max(64);
const inputSchema = z.string().max(32);

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

async function crewFor(visitorId: string, festivalSlug: string): Promise<CrewDTO | null> {
  const member = await prisma.crewMember.findUnique({
    where: { visitorId },
    include: { crew: { include: { members: true } } },
  });
  if (!member) return null;

  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug }, select: { id: true } });
  const others = member.crew.members.filter((m) => m.visitorId !== visitorId).map((m) => m.visitorId);
  const favorites =
    festival && others.length > 0
      ? await prisma.favorite.findMany({
          where: { visitorId: { in: others }, tier: { not: null }, performance: { stage: { festivalId: festival.id } } },
          select: { visitorId: true, performanceId: true, tier: true, note: true },
        })
      : [];

  return toCrewDTO(member.crew.code, member.crew.members, favorites, visitorId);
}

async function resultFor(visitorId: string, festivalSlug: string): Promise<CrewResult> {
  const crew = await crewFor(visitorId, festivalSlug);
  return crew ? { crew } : { error: "not-in-crew" };
}

// The read every open timetable polls. null for anyone not in a crew (and
// without even a DB round trip for a visitor who never opted into sync, so
// the poll costs next to nothing for everyone else), and null on a festival
// with crews off, so nothing leaks there from a stale client either.
export async function getCrew(festivalSlug: string): Promise<CrewDTO | null> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return null;
  const visitorId = await getVisitorId();
  if (!visitorId) return null;
  return crewFor(visitorId, slug);
}

export async function createCrew(festivalSlug: string, tagInput: string): Promise<CrewResult> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return { error: "disabled" };
  const tag = parseTag(inputSchema.parse(tagInput));
  if (!tag) return { error: "bad-tag" };

  const visitorId = await getOrCreateVisitorId();
  if (await prisma.crewMember.findUnique({ where: { visitorId } })) return { error: "already-in-crew" };

  // Same retry-on-collision loop as generatePairingCode: `code` is @unique,
  // and a collision in 887M codes is unlikely but not impossible. A P2002
  // here could also be this visitor racing themselves into a second crew
  // (visitorId is @unique too), which the re-check at the top of the next
  // attempt turns into "already-in-crew".
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0 && (await prisma.crewMember.findUnique({ where: { visitorId } }))) {
      return { error: "already-in-crew" };
    }
    try {
      await prisma.crew.create({
        data: {
          code: generateCrewCode(randomInt),
          members: { create: { visitorId, tag: tag.tag, tagKey: tag.tagKey, colorIndex: 0 } },
        },
      });
      console.info(`[crew] created festival=${slug}`);
      return resultFor(visitorId, slug);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  return { error: "try-again" };
}

export async function joinCrew(festivalSlug: string, codeInput: string, tagInput: string): Promise<CrewResult> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return { error: "disabled" };
  const code = normalizeCrewCode(inputSchema.parse(codeInput));
  if (!code) return { error: "invalid" };
  const tag = parseTag(inputSchema.parse(tagInput));
  if (!tag) return { error: "bad-tag" };

  const visitorId = await getOrCreateVisitorId();
  const existing = await prisma.crewMember.findUnique({ where: { visitorId }, include: { crew: true } });
  if (existing) {
    // Re-entering your own crew's code (a second tap, a paired phone) is a no-op, not an error.
    return existing.crew.code === code ? resultFor(visitorId, slug) : { error: "already-in-crew" };
  }

  // Row-locks the crew so two people taking the last seat (or the same
  // colour) at the same moment queue up instead of both getting in: the
  // second one re-reads the members after the first has committed.
  const outcome = await prisma
    .$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Crew" WHERE "code" = ${code} FOR UPDATE`;
      if (locked.length === 0) return "invalid" as const;
      const crewId = locked[0].id;
      const members = await tx.crewMember.findMany({ where: { crewId }, select: { tagKey: true, colorIndex: true } });
      if (members.length >= CREW_MAX_MEMBERS) return "full" as const;
      if (members.some((m) => m.tagKey === tag.tagKey)) return "tag-taken" as const;
      const colorIndex = nextColorIndex(members.map((m) => m.colorIndex));
      if (colorIndex === null) return "full" as const;
      await tx.crewMember.create({ data: { crewId, visitorId, tag: tag.tag, tagKey: tag.tagKey, colorIndex } });
      return "joined" as const;
    })
    .catch((err: unknown) => {
      // This visitor joining twice at once (visitorId is @unique).
      if (isUniqueViolation(err)) return "already-in-crew" as const;
      throw err;
    });

  if (outcome !== "joined") return { error: outcome };
  console.info(`[crew] joined festival=${slug}`);
  return resultFor(visitorId, slug);
}

const updateSchema = z.object({ tag: inputSchema.optional(), shareNotes: z.boolean().optional() });

export async function updateMyCrewMember(
  festivalSlug: string,
  changes: { tag?: string; shareNotes?: boolean },
): Promise<CrewResult> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return { error: "disabled" };
  const parsed = updateSchema.parse(changes);
  const visitorId = await getVisitorId();
  if (!visitorId) return { error: "not-in-crew" };

  const data: { tag?: string; tagKey?: string; shareNotes?: boolean } = {};
  if (parsed.tag !== undefined) {
    const tag = parseTag(parsed.tag);
    if (!tag) return { error: "bad-tag" };
    data.tag = tag.tag;
    data.tagKey = tag.tagKey;
  }
  if (parsed.shareNotes !== undefined) data.shareNotes = parsed.shareNotes;

  try {
    const updated = await prisma.crewMember.updateMany({ where: { visitorId }, data });
    if (updated.count === 0) return { error: "not-in-crew" };
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "tag-taken" };
    throw err;
  }
  return resultFor(visitorId, slug);
}

// Not gated on a festival: leaving has to work from anywhere, and it only
// ever removes data. The crew row goes with its last member, so an empty
// crew's code stops working instead of lingering as an open door.
export async function leaveCrew(): Promise<{ ok: true }> {
  const visitorId = await getVisitorId();
  if (!visitorId) return { ok: true };
  const member = await prisma.crewMember.findUnique({ where: { visitorId }, select: { crewId: true } });
  if (!member) return { ok: true };
  await prisma.$transaction([
    prisma.crewMember.delete({ where: { visitorId } }),
    prisma.crew.deleteMany({ where: { id: member.crewId, members: { none: {} } } }),
  ]);
  console.info("[crew] left");
  return { ok: true };
}

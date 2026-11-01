"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateVisitorId, getVisitorId } from "@/lib/visitor";
import { crewsEnabled } from "@/lib/festival-copy";
import {
  CREW_MAX_MEMBERS,
  CREW_MAX_PER_VISITOR,
  generateCrewCode,
  nextColorIndex,
  normalizeCrewCode,
  parseCrewName,
  parseTag,
  toCrewsDTO,
} from "@/lib/crew";
import type { CrewResult, CrewsDTO } from "@/types/crew";

// Crews: small groups of visitors who can read each other's Favorite rows. A
// visitor can be in several, and their marks go to all of them. The code is
// the credential (see the Crew model in prisma/schema.prisma). Every write
// is gated on the festival having crews switched on (src/lib/festival-copy.ts)
// so a stale client on a festival that's off can't create data there.
//
// Joining a crew never touches Favorite rows itself: the client turns on
// favorites sync for the festival straight after (useFavoritesSync), which
// is what puts its marks where crewmates can read them.

const slugSchema = z.string().min(1).max(64);
const inputSchema = z.string().max(64);

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

async function crewsFor(visitorId: string, festivalSlug: string): Promise<CrewsDTO> {
  const seats = await prisma.crewMember.findMany({
    where: { visitorId },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    include: { crew: { include: { members: true } } },
  });
  const crews = seats.map((seat) => seat.crew);
  const others = Array.from(new Set(crews.flatMap((crew) => crew.members.map((m) => m.visitorId)))).filter(
    (id) => id !== visitorId,
  );

  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug }, select: { id: true } });
  const favorites =
    festival && others.length > 0
      ? await prisma.favorite.findMany({
          where: { visitorId: { in: others }, tier: { not: null }, performance: { stage: { festivalId: festival.id } } },
          select: { visitorId: true, performanceId: true, tier: true, note: true },
        })
      : [];

  return toCrewsDTO(crews, favorites, visitorId);
}

async function resultFor(visitorId: string, festivalSlug: string): Promise<CrewResult> {
  return { crews: await crewsFor(visitorId, festivalSlug) };
}

async function atCrewLimit(visitorId: string): Promise<boolean> {
  return (await prisma.crewMember.count({ where: { visitorId } })) >= CREW_MAX_PER_VISITOR;
}

// The read every open timetable polls. null for anyone in no crew (and
// without even a DB round trip for a visitor who never opted into sync, so
// the poll costs next to nothing for everyone else), and null on a festival
// with crews off, so nothing leaks there from a stale client either.
export async function getCrews(festivalSlug: string): Promise<CrewsDTO | null> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return null;
  const visitorId = await getVisitorId();
  if (!visitorId) return null;
  const crews = await crewsFor(visitorId, slug);
  return crews.crews.length > 0 ? crews : null;
}

export async function createCrew(festivalSlug: string, tagInput: string, nameInput = ""): Promise<CrewResult> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return { error: "disabled" };
  const tag = parseTag(inputSchema.parse(tagInput));
  if (!tag) return { error: "bad-tag" };
  const name = parseCrewName(inputSchema.parse(nameInput));

  const visitorId = await getOrCreateVisitorId();
  if (await atCrewLimit(visitorId)) return { error: "too-many-crews" };

  // Same retry-on-collision loop as generatePairingCode: `code` is @unique,
  // and a collision in 887M codes is unlikely but not impossible.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.crew.create({
        data: {
          code: generateCrewCode(randomInt),
          name,
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

  // Re-entering a code you're already in (a second tap, a paired phone) is a
  // no-op, whatever tag was typed. Checked before the crew limit, so it's a
  // no-op at the limit too.
  const seat = await prisma.crewMember.findFirst({ where: { visitorId, crew: { code } }, select: { id: true } });
  if (seat) return resultFor(visitorId, slug);
  if (await atCrewLimit(visitorId)) return { error: "too-many-crews" };

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
    .catch(async (err: unknown) => {
      if (!isUniqueViolation(err)) throw err;
      // Either this visitor's own double tap, and the seat is already
      // theirs, or a crewmate took this tag with a rename, which doesn't
      // queue on the lock.
      const taken = await prisma.crewMember.findFirst({ where: { visitorId, crew: { code } }, select: { id: true } });
      return taken ? ("joined" as const) : ("tag-taken" as const);
    });

  if (outcome !== "joined") return { error: outcome };
  console.info(`[crew] joined festival=${slug}`);
  return resultFor(visitorId, slug);
}

const updateSchema = z.object({ tag: inputSchema.optional(), shareNotes: z.boolean().optional() });

// Scoped to { crewId, visitorId }: your own seat in that crew, nobody else's.
export async function updateMyCrewMember(
  festivalSlug: string,
  crewIdInput: string,
  changes: { tag?: string; shareNotes?: boolean },
): Promise<CrewResult> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return { error: "disabled" };
  const crewId = inputSchema.parse(crewIdInput);
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
    const updated = await prisma.crewMember.updateMany({ where: { crewId, visitorId }, data });
    if (updated.count === 0) return { error: "not-in-crew" };
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "tag-taken" };
    throw err;
  }
  return resultFor(visitorId, slug);
}

// Any member can rename a crew, since a crew has no owner. The members
// filter is what stops anyone else: a crew id isn't a secret once you've
// shared a crew and left it.
export async function renameCrew(festivalSlug: string, crewIdInput: string, nameInput: string): Promise<CrewResult> {
  const slug = slugSchema.parse(festivalSlug);
  if (!crewsEnabled(slug)) return { error: "disabled" };
  const crewId = inputSchema.parse(crewIdInput);
  const name = parseCrewName(inputSchema.parse(nameInput));
  const visitorId = await getVisitorId();
  if (!visitorId) return { error: "not-in-crew" };

  const updated = await prisma.crew.updateMany({ where: { id: crewId, members: { some: { visitorId } } }, data: { name } });
  if (updated.count === 0) return { error: "not-in-crew" };
  return resultFor(visitorId, slug);
}

// The delete isn't gated on a festival: leaving has to work from anywhere,
// and it only ever removes data. The crew row goes with its last member, so
// an empty crew's code stops working instead of lingering as an open door.
// The slug only scopes the crews handed back.
export async function leaveCrew(festivalSlug: string, crewIdInput: string): Promise<CrewsDTO | null> {
  const slug = slugSchema.parse(festivalSlug);
  const crewId = inputSchema.parse(crewIdInput);
  const visitorId = await getVisitorId();
  if (!visitorId) return null;
  await prisma.$transaction([
    prisma.crewMember.deleteMany({ where: { crewId, visitorId } }),
    prisma.crew.deleteMany({ where: { id: crewId, members: { none: {} } } }),
  ]);
  console.info("[crew] left");
  const crews = await crewsFor(visitorId, slug);
  return crews.crews.length > 0 ? crews : null;
}

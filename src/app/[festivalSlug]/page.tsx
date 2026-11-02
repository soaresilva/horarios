import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimetableApp } from "@/components/TimetableApp";
import { isFestivalOver, isFestivalVisible } from "@/lib/festival";
import { prisma } from "@/lib/prisma";
import { hasAdminSession } from "@/lib/session";

interface Props {
  params: Promise<{ festivalSlug: string }>;
}

// Null for a missing festival and for an unpublished one the request can't
// see. Metadata goes through this too, or the <title> would give it away.
async function visibleFestival(slug: string) {
  const festival = await prisma.festival.findUnique({ where: { slug } });
  return festival && isFestivalVisible(festival, await hasAdminSession()) ? festival : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { festivalSlug } = await params;
  const festival = await visibleFestival(festivalSlug);
  if (!festival) return {};

  const archived = isFestivalOver(festival.endDate);
  return {
    title: `${festival.name} · Horários Bolachas`,
    description: `${archived ? "Archived" : "Offline-friendly"} stage timetable for ${festival.name}.`,
  };
}

export default async function FestivalPage({ params }: Props) {
  const { festivalSlug } = await params;
  const festival = await visibleFestival(festivalSlug);
  if (!festival) notFound();

  return (
    <TimetableApp
      festivalSlug={festival.slug}
      ft={{ timezone: festival.timezone, locale: festival.locale }}
      layout={festival.layout}
    />
  );
}

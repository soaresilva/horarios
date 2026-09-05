import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TimetableApp } from "@/components/TimetableApp";
import { isFestivalOver } from "@/lib/festival";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ festivalSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { festivalSlug } = await params;
  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug } });
  if (!festival) return {};

  const archived = isFestivalOver(festival.endDate);
  return {
    title: `${festival.name} · Horários Bolachas`,
    description: `${archived ? "Archived" : "Offline-friendly"} stage timetable for ${festival.name}.`,
  };
}

export default async function FestivalPage({ params }: Props) {
  const { festivalSlug } = await params;
  const festival = await prisma.festival.findUnique({ where: { slug: festivalSlug } });
  if (!festival) notFound();

  return <TimetableApp festivalSlug={festival.slug} />;
}

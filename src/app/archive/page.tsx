import { FestivalIndex } from "@/components/FestivalIndex";
import { prisma } from "@/lib/prisma";

export default async function ArchivePage() {
  const festivals = await prisma.festival.findMany({ orderBy: { startDate: "desc" } });
  return <FestivalIndex festivals={festivals} />;
}

import { FestivalIndex } from "@/components/FestivalIndex";
import { prisma } from "@/lib/prisma";

// Per request, same reason as src/app/page.tsx.
export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const festivals = await prisma.festival.findMany({ where: { published: true }, orderBy: { startDate: "desc" } });
  return <FestivalIndex festivals={festivals} />;
}

import { redirect } from "next/navigation";
import { FestivalIndex } from "@/components/FestivalIndex";
import { pickFeatured } from "@/lib/festival";
import { prisma } from "@/lib/prisma";

// `/` goes straight to the festival picked in /admin; with none picked it
// falls back to the archive list (same markup as /archive).
export default async function Home() {
  const festivals = await prisma.festival.findMany({ orderBy: { startDate: "desc" } });
  const featured = pickFeatured(festivals);
  if (featured) redirect(`/${featured.slug}`);
  return <FestivalIndex festivals={festivals} />;
}

import { redirect } from "next/navigation";
import { FestivalIndex } from "@/components/FestivalIndex";
import { pickFeatured } from "@/lib/festival";
import { prisma } from "@/lib/prisma";

// Rendered per request, not prerendered: which festivals are public must never
// rest on a cached page. A restarted server trusted a stale copy that still
// listed an unpublished festival, because revalidatePath's invalidation lived
// in the old process.
export const dynamic = "force-dynamic";

// `/` goes straight to the festival picked in /admin; with none picked it
// falls back to the archive list (same markup as /archive).
export default async function Home() {
  const festivals = await prisma.festival.findMany({ where: { published: true }, orderBy: { startDate: "desc" } });
  const featured = pickFeatured(festivals);
  if (featured) redirect(`/${featured.slug}`);
  return <FestivalIndex festivals={festivals} />;
}

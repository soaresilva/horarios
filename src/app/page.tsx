import Link from "next/link";
import { SocialLinks } from "@/components/SocialLinks";
import { formatFestivalDateRange, isFestivalOver } from "@/lib/festival";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const festivals = await prisma.festival.findMany({ orderBy: { startDate: "desc" } });

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 px-4 py-10 text-zinc-100">
      <header className="flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-wide text-zinc-300">
          <a href="https://bolachas.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400">
            Horários Bolachas
          </a>
        </h1>
        <SocialLinks />
      </header>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-500">Festival timetable archive.</p>
        {festivals.length === 0 ? (
          <p className="text-sm text-zinc-600">No festivals yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {festivals.map((festival) => (
              <li key={festival.id}>
                <Link
                  href={`/${festival.slug}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 px-4 py-3 transition-colors hover:border-accent hover:bg-zinc-900"
                >
                  <span className="flex flex-col">
                    <span className="font-medium text-zinc-100">{festival.name}</span>
                    <span className="text-xs text-zinc-600">{festival.location}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-xs text-zinc-500">
                      {formatFestivalDateRange(festival.startDate, festival.endDate)}
                    </span>
                    {isFestivalOver(festival.endDate) && (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                        Archived
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { CrewPanel } from "@/components/CrewPanel";
import type { UseCrewResult } from "@/hooks/useCrew";
import type { FestivalTime } from "@/lib/time";

interface CrewButtonProps {
  crew: UseCrewResult;
  festivalSlug: string;
  ft: FestivalTime;
}

// Legend-row entry point for crews, next to SyncFavoritesButton and built
// the same way: a small text button that opens an anchored popover.
// Rendered only on festivals with crews switched on (TimetableApp). One crew
// counts its people, several count the crews.
export function CrewButton({ crew, festivalSlug, ft }: CrewButtonProps) {
  const [open, setOpen] = useState(false);
  const { crews } = crew;
  const label =
    crews.length === 0 ? "crew" : crews.length === 1 ? `crew (${crews[0].members.length + 1})` : `crews (${crews.length})`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={crews.length > 0 ? "Your crews" : "Share your picks with friends"}
        className={`flex items-center gap-1 ${crews.length > 0 ? "text-accent" : "text-zinc-500"}`}
      >
        <span aria-hidden>◍</span>
        <span>{label}</span>
      </button>
      {open && <CrewPanel crew={crew} festivalSlug={festivalSlug} ft={ft} onClose={() => setOpen(false)} />}
    </div>
  );
}

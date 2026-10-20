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
// Rendered only on festivals with crews switched on (TimetableApp).
export function CrewButton({ crew, festivalSlug, ft }: CrewButtonProps) {
  const [open, setOpen] = useState(false);
  const size = crew.crew ? crew.crew.members.length + 1 : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={crew.crew ? "Your crew" : "Share your picks with friends"}
        className={`flex items-center gap-1 ${crew.crew ? "text-accent" : "text-zinc-500"}`}
      >
        <span aria-hidden>◍</span>
        <span>{crew.crew ? `crew (${size})` : "crew"}</span>
      </button>
      {open && <CrewPanel crew={crew} festivalSlug={festivalSlug} ft={ft} onClose={() => setOpen(false)} />}
    </div>
  );
}

"use client";

import { Pencil } from "@/components/icons";

// Clone of RecommendationsToggle.tsx's track/knob/role="switch" shape, but
// takes { show, onToggle } as props rather than calling a hook itself:
// TimetableApp needs `show` anyway to thread into the grids via MarkControls,
// and useShowNotes needs a festival slug this component has no other reason
// to know. `py-1.5` gives the button a ~26px tall hit area — unlike the
// other controls-row toggles, this one has to work reliably with a thumb,
// since it's the switch that matters most on a phone at the festival.
export function NotesToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      title={show ? "Hide notes inline" : "Show notes inline"}
      className="flex items-center gap-1.5 py-1.5"
    >
      <span
        aria-hidden
        className={`relative block h-3.5 w-6 shrink-0 rounded-full transition-colors ${
          show ? "bg-accent" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white transition-all ${
            show ? "left-3" : "left-0.5"
          }`}
        />
      </span>
      <Pencil className={`h-3 w-3 ${show ? "text-accent" : "text-zinc-500"}`} />
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>display notes</span>
    </button>
  );
}

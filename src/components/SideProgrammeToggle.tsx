"use client";

import { EyeOff } from "@/components/icons";
import type { SideProgrammeCopy } from "@/lib/festival-copy";

// Same track/knob/role="switch" shape and py-1.5 thumb-sized hit area as
// NotesToggle. Rendered only for festivals that have side-programme sets
// (TimetableApp decides), so Paredes de Coura never shows it. The chip and
// words are the festival's own (src/lib/festival-copy.ts): a dashed FREE
// chip for LOTD's Official Unofficial, U? for Le Guess Who?.
export function SideProgrammeToggle({
  show,
  onToggle,
  copy,
}: {
  show: boolean;
  onToggle: () => void;
  copy: SideProgrammeCopy;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      // The chip is aria-hidden decoration, so the name carries it: "U?
      // programme" means something to a screen reader, "programme" doesn't.
      aria-label={`${copy.chip} ${copy.label}`}
      title={show ? `Hide ${copy.description}` : `Show ${copy.description}`}
      className="flex items-center gap-1.5 py-1.5"
    >
      <SwitchTrack on={show} />
      <span
        aria-hidden
        className={`rounded border border-dashed px-1 text-[9px] leading-tight font-semibold ${
          show ? "border-zinc-400 text-zinc-300" : "border-zinc-600 text-zinc-500"
        }`}
      >
        {copy.chip}
      </span>
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>{copy.label}</span>
    </button>
  );
}

// The non-concerts switch: films, talks, workshops, exhibitions and other
// non-music items. Rendered only when the festival has any.
export function NonConcertsToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      title={show ? "Hide films, talks, workshops and exhibitions" : "Show films, talks, workshops and exhibitions"}
      className="flex items-center gap-1.5 py-1.5"
    >
      <SwitchTrack on={show} />
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>films, talks &amp; exhibitions</span>
    </button>
  );
}

// The "show hidden" switch. Rendered only while the visitor has hidden at
// least one act on this festival (TimetableApp decides), so nobody sees a
// control for a feature they haven't used. The count says how much is out
// of view.
export function HiddenToggle({ show, count, onToggle }: { show: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      aria-label={`Show hidden acts (${count})`}
      title={show ? "Hide the acts you hid again" : "Show the acts you hid, dimmed"}
      className="flex items-center gap-1.5 py-1.5"
    >
      <SwitchTrack on={show} />
      <EyeOff className={`h-3 w-3 ${show ? "text-zinc-400" : "text-zinc-500"}`} />
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>hidden ({count})</span>
    </button>
  );
}

function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-3.5 w-6 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-zinc-700"}`}
    >
      <span
        className={`absolute top-0.5 block h-2.5 w-2.5 rounded-full bg-white transition-all ${on ? "left-3" : "left-0.5"}`}
      />
    </span>
  );
}

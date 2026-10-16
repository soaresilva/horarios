"use client";

// Same track/knob/role="switch" shape and py-1.5 thumb-sized hit area as
// NotesToggle. Rendered only for festivals that have side-programme sets
// (TimetableApp decides), so Paredes de Coura never shows it.
export function SideProgrammeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      title={show ? "Hide the free daytime side programme" : "Show the free daytime side programme"}
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
      <span
        aria-hidden
        className={`rounded border border-dashed px-1 text-[9px] leading-tight font-semibold ${
          show ? "border-zinc-400 text-zinc-300" : "border-zinc-600 text-zinc-500"
        }`}
      >
        FREE
      </span>
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>daytime shows</span>
    </button>
  );
}

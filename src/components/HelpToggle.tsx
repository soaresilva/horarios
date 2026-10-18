"use client";

// Same track/knob/role="switch" shape and py-1.5 thumb-sized hit area as
// NotesToggle and the side-programme switches. Takes { show, onToggle } as
// props: TimetableApp owns the preference so it can decide what to render.
export function HelpToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={show}
      onClick={onToggle}
      title={show ? "Hide help text" : "Show help text"}
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
      <span className={show ? "text-zinc-400" : "text-zinc-500"}>help text</span>
    </button>
  );
}

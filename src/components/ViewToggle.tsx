"use client";

export type TimetableView = "grid" | "list";

interface ViewToggleProps {
  view: TimetableView;
  onChange: (view: TimetableView) => void;
}

// A choice between two named states, not an on/off setting, so this is two
// buttons in a pill rather than RecommendationsToggle's role="switch" —
// same selected/unselected treatment DayTabs already uses for its day pills.
export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-800/60 p-0.5 text-[10px]" role="group" aria-label="Timetable view">
      {(
        [
          { value: "grid", label: "Grid" },
          { value: "list", label: "My favorites" },
        ] as const
      ).map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`rounded-md px-2 py-1 font-medium ${
            view === value ? "bg-accent text-background" : "text-zinc-400"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

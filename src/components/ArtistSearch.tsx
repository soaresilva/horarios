"use client";

import { Close, EyeOff, Search } from "@/components/icons";
import type { MarkControls } from "@/hooks/useMarks";
import type { Performance, Stage } from "@/lib/schedule-client";
import { parseCancellation } from "@/lib/shows";
import { formatClock, formatDayTabLabel, type FestivalTime } from "@/lib/time";

interface SearchFieldProps {
  query: string;
  onChange: (query: string) => void;
}

// Always on screen rather than behind a search icon: on a phone the row it
// sits in is otherwise empty to the left of the view toggle, and "when do
// they play" shouldn't cost an extra tap.
export function SearchField({ query, onChange }: SearchFieldProps) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      {/* 16px on phones: iOS Safari zooms the page into any input whose
          font is smaller than that, and the layout's maximumScale only
          usually stops it. */}
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Search acts"
        aria-label="Search acts"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        className="w-full rounded-lg bg-zinc-800/60 py-1 pr-7 pl-7 text-base text-zinc-100 placeholder:text-zinc-500 focus:ring-1 focus:ring-accent focus:outline-none sm:text-xs [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 -translate-y-1/2 p-1"
        >
          <Close className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      )}
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  /** Already matched and sorted (searchPerformances in src/lib/search.ts). */
  results: Performance[];
  stages: Stage[];
  marks: MarkControls;
  /** Tag after a side-programme set ("free daytime", "U?"). */
  sideTag: string;
  ft: FestivalTime;
  onSelect: (id: string) => void;
}

// The whole festival, one row per set: the answer to "when do they play" is
// the day, the time and the room, so that's all a row carries. Tapping one
// opens MarkSheet, which already does marking, notes, hiding and "Also
// plays". Hidden acts are listed (dimmed): you asked for this act by name.
export function SearchResults({ query, results, stages, marks, sideTag, ft, onSelect }: SearchResultsProps) {
  if (results.length === 0) {
    return <p className="p-4 text-sm text-zinc-500">No act matches “{query.trim()}”.</p>;
  }

  const stageNames = new Map(stages.map((s) => [s.id, s.name]));

  return (
    <ul className="flex-1 overflow-y-auto px-3 pb-6" aria-label="Search results">
      {results.map((performance) => {
        const { cancelled, displayName } = parseCancellation(performance.artistName);
        const { weekday, day } = formatDayTabLabel(new Date(`${performance.date}T12:00:00Z`), ft);
        const tier = marks.tierOf(performance.id);
        const hidden = marks.actHidden?.(performance.id) ?? false;
        return (
          <li key={performance.id} data-hidden={hidden ? "true" : undefined} className={hidden ? "opacity-40" : ""}>
            <button
              type="button"
              onClick={() => onSelect(performance.id)}
              className="flex w-full items-baseline gap-2 border-b border-zinc-800/80 py-2.5 text-left"
            >
              <span className="w-12 shrink-0 text-xs font-medium text-zinc-300">
                {weekday} {day}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-medium text-zinc-100">
                  {hidden && <EyeOff className="mr-1 inline-block h-3 w-3 align-[-0.125em] text-zinc-400" />}
                  {cancelled && <span className="text-zinc-500">[cancelled] </span>}
                  <span className={cancelled ? "text-zinc-500 line-through" : ""}>{displayName}</span>
                  {tier === "must" && (
                    <span aria-label="must-see" className="ml-1 text-accent">
                      ★
                    </span>
                  )}
                  {tier === "interested" && (
                    <span aria-label="interested" className="ml-1 text-interested">
                      ☆
                    </span>
                  )}
                </span>
                <span className="block text-xs leading-tight text-zinc-400">
                  {formatClock(performance.startTime, ft)}–{formatClock(performance.endTime, ft)} ·{" "}
                  {stageNames.get(performance.stageId) ?? ""}
                  {performance.series && <span className="text-zinc-500"> · {sideTag}</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import { formatDayTabLabel } from "@/lib/time";

interface DayTabsProps {
  days: string[];
  selected: string;
  today: string;
  onSelect: (day: string) => void;
}

export function DayTabs({ days, selected, today, onSelect }: DayTabsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2" role="tablist" aria-label="Festival day">
      {days.map((day) => {
        const { weekday, day: dayNum } = formatDayTabLabel(new Date(`${day}T12:00:00Z`));
        const isSelected = day === selected;
        return (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(day)}
            className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-1.5 ${
              isSelected ? "bg-zinc-100 text-zinc-950" : "bg-zinc-800/60 text-zinc-300"
            }`}
          >
            <span className="text-[10px] font-medium leading-tight">{weekday}</span>
            <span className="text-sm leading-tight font-semibold">{dayNum}</span>
            {day === today && (
              <span
                aria-hidden
                className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-zinc-950" : "bg-red-500"}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

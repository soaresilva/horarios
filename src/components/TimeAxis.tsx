import { generateTimeTicks, windowHeight, type GridWindow } from "@/lib/time";

export function TimeAxis({ window }: { window: GridWindow }) {
  const ticks = generateTimeTicks(window);
  return (
    <div className="relative w-11 shrink-0" style={{ height: windowHeight(window) }}>
      {ticks.map((tick) => (
        <div
          key={tick.offset}
          className={`absolute right-1 -translate-y-1/2 text-[10px] leading-none ${
            tick.isHour ? "font-medium text-zinc-300" : "text-zinc-600"
          }`}
          style={{ top: tick.offset }}
        >
          {tick.label}
        </div>
      ))}
    </div>
  );
}

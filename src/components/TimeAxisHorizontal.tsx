import { generateTimeTicks, HORIZONTAL_SCALE, windowExtent, type FestivalTime, type GridWindow } from "@/lib/time";

// The transposed twin of TimeAxis. Ticks every 10 minutes (every published
// Left of the Dial start time falls on a :10 boundary) but a label only every
// 30, because horizontal labels sit side by side and would otherwise collide
// — that's what TimeTick.minutes is for.
export function TimeAxisHorizontal({ window, ft }: { window: GridWindow; ft: FestivalTime }) {
  const ticks = generateTimeTicks(window, ft, 10, HORIZONTAL_SCALE);
  const width = windowExtent(window, HORIZONTAL_SCALE);
  const lastOffset = ticks.at(-1)?.offset ?? 0;

  return (
    <div className="relative h-7 shrink-0" style={{ width }}>
      {ticks.map((tick) => {
        const labelled = tick.minutes % 30 === 0;
        // The first and last labels would bleed outside the track if they
        // were centred on their tick like the rest.
        const align =
          tick.offset === 0
            ? "translate-x-0"
            : tick.offset === lastOffset
              ? "-translate-x-full"
              : "-translate-x-1/2";

        return (
          <div key={tick.offset}>
            <div
              className={`absolute top-4 bottom-0 w-px ${tick.isHour ? "bg-zinc-700" : "bg-zinc-800"}`}
              style={{ left: tick.offset }}
            />
            {labelled && (
              <span
                className={`absolute top-0 text-[10px] leading-none ${align} ${
                  tick.isHour ? "font-medium text-zinc-300" : "text-zinc-600"
                }`}
                style={{ left: tick.offset }}
              >
                {tick.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

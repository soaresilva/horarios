import {
  DEFAULT_HORIZONTAL_SCALE,
  generateTimeTicks,
  windowExtent,
  type FestivalTime,
  type GridWindow,
  type HorizontalScale,
} from "@/lib/time";

// The transposed twin of TimeAxis. Ticks every `scale.tickMinutes` (10 for
// Left of the Dial, whose starts all fall on :10 boundaries; 15 for Le Guess
// Who?) but a label only every 30, because horizontal labels sit side by
// side and would otherwise collide — that's what TimeTick.minutes is for.
export function TimeAxisHorizontal({
  window,
  ft,
  scale = DEFAULT_HORIZONTAL_SCALE,
}: {
  window: GridWindow;
  ft: FestivalTime;
  scale?: HorizontalScale;
}) {
  const ticks = generateTimeTicks(window, ft, scale.tickMinutes, scale);
  const width = windowExtent(window, scale);
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

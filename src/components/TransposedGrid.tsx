"use client";

import { useEffect, useRef } from "react";
import { TimeAxisHorizontal } from "@/components/TimeAxisHorizontal";
import { TransposedPerformanceBlock } from "@/components/TransposedPerformanceBlock";
import { useNow } from "@/hooks/useNow";
import { useShowRecommendations } from "@/hooks/useShowRecommendations";
import { artistLinksFor } from "@/lib/artist-links";
import { activeStagesSortedByOrder, stagesByZone } from "@/lib/grouping";
import type { Artist, Performance, Stage, Zone, ZoneWalk } from "@/lib/schedule-client";
import type { ShowOrdinal } from "@/lib/shows";
import { zoneWalkLabel } from "@/lib/zones";
import {
  blockLayout,
  computeDayWindow,
  currentTimeOffset,
  formatClock,
  HORIZONTAL_SCALE,
  windowExtent,
  type FestivalTime,
} from "@/lib/time";

// Width of the pinned venue column. One constant, used by the corner cell,
// every venue cell and the now-line's offset — the vertical grid hand-copies
// its gutter width between two files, which is exactly the bug this avoids.
const VENUE_COL_PX = 112;
const VENUE_COL = "w-28";
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 28;

interface TransposedGridProps {
  stages: Stage[];
  zones: Zone[];
  zoneWalks: ZoneWalk[];
  performances: Performance[];
  artistsById: Map<string, Artist>;
  ordinals: Map<string, ShowOrdinal>;
  originPerformanceId: string | null;
  isStarred: (id: string) => boolean;
  ft: FestivalTime;
  onSelectOrigin: (id: string) => void;
  onToggleStar: (id: string) => void;
}

function mapsUrl(stage: Stage): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${stage.name}, ${stage.address ?? "Rotterdam"}`,
  )}`;
}

export function TransposedGrid({
  stages,
  zones,
  zoneWalks,
  performances,
  artistsById,
  ordinals,
  originPerformanceId,
  isStarred,
  ft,
  onSelectOrigin,
  onToggleStar,
}: TransposedGridProps) {
  const { show: showRecommendations } = useShowRecommendations();
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const now = useNow(30_000);

  const window = computeDayWindow(performances);
  const active = activeStagesSortedByOrder(stages, performances);
  const groups = stagesByZone(active, zones);
  const totalWidth = window ? windowExtent(window, HORIZONTAL_SCALE) : 0;
  const nowOffset = window && now ? currentTimeOffset(window, now, HORIZONTAL_SCALE) : null;

  // Which venue the walking distances are measured from. The origin is a
  // *set*, so it carries an end time too — that's what a future "dim the
  // sets you can't reach" pass would need.
  const origin = performances.find((p) => p.id === originPerformanceId) ?? null;
  const originStage = origin ? stages.find((s) => s.id === origin.stageId) : null;
  const originZone = originStage ? (zones.find((z) => z.id === originStage.zoneId) ?? null) : null;

  // Open on "now". Deliberately an imperative scrollLeft rather than
  // scrollIntoView: in a two-axis container that tall, scrollIntoView also
  // moves the Y axis and drops the viewer at the bottom of the venue list.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || nowOffset === null || hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    el.scrollLeft = Math.max(0, nowOffset - (el.clientWidth - VENUE_COL_PX) / 2);
  }, [nowOffset]);

  if (!window) {
    return <p className="p-4 text-sm text-zinc-500">No performances scheduled for this day yet.</p>;
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto overscroll-contain">
      {/* w-max so the content box is as wide as the widest row, which is what
          gives the scroller a real horizontal extent. */}
      <div className="relative w-max">
        {/* Header row pins on Y; the corner inside it also pins on X. Sticky
            on orthogonal axes nests correctly, which is what lets this be one
            scroll container instead of three JS-synced panes. Every sticky
            surface here is opaque — a backdrop-filter on a sticky element
            inside a scroller makes Safari recompute it every frame. */}
        <div className="sticky top-0 z-30 flex bg-background">
          <div className={`sticky left-0 z-40 ${VENUE_COL} shrink-0 bg-background`} />
          <TimeAxisHorizontal window={window} ft={ft} />
        </div>

        {groups.map(({ zone, stages: zoneStages }) => {
          const label = zone
            ? zoneWalkLabel(zone, zoneWalks, originZone?.id ?? null, originZone?.name ?? null)
            : null;

          return (
            <div key={zone?.id ?? "unzoned"}>
              {zone && (
                // Pins on X only. Never top-0 as well, which would fight the
                // time axis for the same slot.
                <div className="sticky left-0 z-20 flex w-max items-baseline gap-2 border-t border-zinc-800 bg-background px-2 py-1">
                  <span className="text-[10px] font-semibold tracking-wide text-accent uppercase">
                    {zone.name}
                  </span>
                  {label && <span className="text-[10px] text-zinc-600">{label}</span>}
                </div>
              )}

              {zoneStages.map((stage) => {
                const stagePerformances = performances
                  .filter((p) => p.stageId === stage.id)
                  .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

                return (
                  <div key={stage.id} className="flex" style={{ height: ROW_HEIGHT }}>
                    <div
                      className={`sticky left-0 z-20 ${VENUE_COL} flex shrink-0 items-center border-r border-zinc-800 bg-background px-2`}
                    >
                      <a
                        href={mapsUrl(stage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 text-[10px] leading-tight text-zinc-400 hover:text-accent"
                      >
                        {stage.name}
                      </a>
                    </div>

                    <div className="relative border-b border-zinc-900" style={{ width: totalWidth }}>
                      {stagePerformances.map((performance) => (
                        <TransposedPerformanceBlock
                          key={performance.id}
                          performance={performance}
                          artist={performance.artistId ? artistsById.get(performance.artistId) : undefined}
                          layout={blockLayout(window, performance, HORIZONTAL_SCALE)}
                          links={artistLinksFor(performance, artistsById)}
                          starred={isStarred(performance.id)}
                          showRecommendation={showRecommendations}
                          ordinal={ordinals.get(performance.id)}
                          isOrigin={performance.id === originPerformanceId}
                          ft={ft}
                          onSelectOrigin={onSelectOrigin}
                          onToggleStar={onToggleStar}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {nowOffset !== null && (
          <>
            <div
              className="pointer-events-none absolute z-10 w-px bg-red-500"
              style={{ left: VENUE_COL_PX + nowOffset, top: HEADER_HEIGHT, bottom: 0 }}
            />
            {/* Sits inside the sticky header band so the clock stays readable
                at the top of the viewport instead of scrolling away. */}
            <span
              className="pointer-events-none absolute z-40 -translate-x-1/2 rounded bg-red-500 px-1 text-[10px] font-semibold text-white"
              style={{ left: VENUE_COL_PX + nowOffset, top: 2 }}
            >
              {formatClock(now!, ft)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

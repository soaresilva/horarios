import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TransposedGrid } from "./TransposedGrid";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Performance, Stage } from "@/lib/schedule-client";
import type { MarkControls } from "@/hooks/useMarks";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const stages: Stage[] = [
  { id: "annabel-up", name: "Annabel Up", slug: "annabel-up", order: 0, zoneId: null, address: null },
  { id: "v11", name: "V11", slug: "v11", order: 1, zoneId: null, address: null },
];

const performances: Performance[] = [
  {
    id: "noted",
    artistName: "Gordi",
    date: "2026-10-23",
    startTime: lisbon("2026-10-23T20:20:00"),
    endTime: lisbon("2026-10-23T21:00:00"),
    notes: null,
    recommended: false,
    stageId: "annabel-up",
    artistId: null,
  },
  {
    id: "unnoted",
    artistName: "Sprints",
    date: "2026-10-23",
    startTime: lisbon("2026-10-23T20:40:00"),
    endTime: lisbon("2026-10-23T21:20:00"),
    notes: null,
    recommended: false,
    stageId: "v11",
    artistId: null,
  },
];

function fakeMarks(overrides: Partial<MarkControls> = {}): MarkControls {
  return {
    tierOf: () => null,
    noteOf: () => "",
    cycle: () => {},
    setTier: () => {},
    setNote: () => {},
    openSheet: () => {},
    showNotes: false,
    ...overrides,
  };
}

function renderGrid(marks: MarkControls) {
  return render(
    <TransposedGrid
      stages={stages}
      zones={[]}
      zoneWalks={[]}
      performances={performances}
      artistsById={new Map()}
      ordinals={new Map()}
      originPerformanceId={null}
      marks={marks}
      ft={ft}
      onSelectOrigin={() => {}}
    />,
  );
}

// Row height is set on the flex row div that is the parent of both the
// sticky venue cell and the relative performances column, per stage.
function rowHeightFor(container: HTMLElement, performanceId: string): string | undefined {
  const block = container.querySelector(`[data-performance-id="${performanceId}"]`);
  const row = block?.closest("div.flex[style]") as HTMLElement | null;
  return row?.style.height;
}

describe("TransposedGrid — row height grows only for annotated rows", () => {
  it("a venue row holding a noted set is 72px when showNotes is on", () => {
    const noteOf = (id: string) => (id === "noted" ? "sounds like Bikini Kill" : "");
    const { container } = renderGrid(fakeMarks({ noteOf, showNotes: true }));

    expect(rowHeightFor(container, "noted")).toBe("72px");
  });

  it("a venue row with no noted set stays 56px when showNotes is on", () => {
    const noteOf = (id: string) => (id === "noted" ? "sounds like Bikini Kill" : "");
    const { container } = renderGrid(fakeMarks({ noteOf, showNotes: true }));

    expect(rowHeightFor(container, "unnoted")).toBe("56px");
  });

  it("both rows stay 56px when showNotes is off, even with a note present", () => {
    const noteOf = (id: string) => (id === "noted" ? "sounds like Bikini Kill" : "");
    const { container } = renderGrid(fakeMarks({ noteOf, showNotes: false }));

    expect(rowHeightFor(container, "noted")).toBe("56px");
    expect(rowHeightFor(container, "unnoted")).toBe("56px");
  });
});

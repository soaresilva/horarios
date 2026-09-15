import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageGrid } from "./StageGrid";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Performance, Stage } from "@/lib/schedule-client";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";

const stages: Stage[] = [
  { id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0, zoneId: null, address: null },
  { id: "palco2", name: "Palco 2", slug: "palco-2", order: 1, zoneId: null, address: null },
];

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const performances: Performance[] = [
  {
    id: "p1",
    artistName: "Cass McCombs",
    date: "2026-08-13",
    startTime: lisbon("2026-08-13T19:40:00"),
    endTime: lisbon("2026-08-13T20:45:00"),
    notes: null,
    recommended: false,
    stageId: "vodafone", artistId: null,
  },
  {
    id: "p2",
    artistName: "Perfume Genius",
    date: "2026-08-13",
    startTime: lisbon("2026-08-13T20:40:00"),
    endTime: lisbon("2026-08-13T21:40:00"),
    notes: null,
    recommended: true,
    stageId: "palco2", artistId: null,
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
    ...overrides,
  };
}

function tierOfMap(map: Record<string, MarkTier>) {
  return (id: string): MarkTier | null => map[id] ?? null;
}

describe("StageGrid", () => {
  it("renders one block per performance, positioned by its own stage column", () => {
    const { container } = render(<StageGrid stages={stages} performances={performances} ft={ft} marks={fakeMarks()} />);

    expect(screen.getByText("Cass McCombs")).toBeInTheDocument();
    expect(screen.getByText("Perfume Genius")).toBeInTheDocument();
    // Window start floors the earliest start (19:40) to 19:00; 19:40 is 40 minutes later, at 2px/min.
    // top/height live on the block's root div, not the star-toggle button nested inside it.
    expect(container.querySelector('[data-performance-id="p1"]')).toHaveStyle({ top: "80px" });
  });

  it("shows an empty-state message instead of a grid when there are no performances", () => {
    render(<StageGrid stages={stages} performances={[]} ft={ft} marks={fakeMarks()} />);
    expect(screen.getByText(/no performances scheduled/i)).toBeInTheDocument();
  });

  it("calls marks.cycle with the performance id when a block is tapped", async () => {
    const cycle = vi.fn();
    const user = userEvent.setup();
    render(<StageGrid stages={stages} performances={performances} ft={ft} marks={fakeMarks({ cycle })} />);

    await user.click(screen.getByRole("button", { name: /Cass McCombs/ }));
    expect(cycle).toHaveBeenCalledWith("p1");
  });

  it("shows the bolachas-recommends marker only on recommended performances", () => {
    render(<StageGrid stages={stages} performances={performances} ft={ft} marks={fakeMarks()} />);

    // Perfume Genius is recommended (fixture), Cass McCombs is not. The marker
    // is an aria-hidden SVG, so assert on the DOM within each act's button.
    const recommended = screen.getByRole("button", { name: /Perfume Genius/ });
    const notRecommended = screen.getByRole("button", { name: /Cass McCombs/ });
    expect(recommended.querySelector("svg")).toBeInTheDocument();
    expect(notRecommended.querySelector("svg")).not.toBeInTheDocument();
  });

  it("reflects tier state via aria-label", () => {
    render(<StageGrid stages={stages} performances={performances} ft={ft} marks={fakeMarks({ tierOf: tierOfMap({ p1: "must" }) })} />);

    expect(screen.getByRole("button", { name: /Cass McCombs/ })).toHaveAttribute("aria-label", "Mark Cass McCombs: must-see, tap to change");
    expect(screen.getByRole("button", { name: /Perfume Genius/ })).toHaveAttribute("aria-label", "Mark Perfume Genius: unmarked, tap to change");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageGrid } from "./StageGrid";
import type { Performance, Stage } from "@/lib/schedule-client";

const stages: Stage[] = [
  { id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0 },
  { id: "palco2", name: "Palco 2", slug: "palco-2", order: 1 },
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
    stageId: "vodafone",
  },
  {
    id: "p2",
    artistName: "Perfume Genius",
    date: "2026-08-13",
    startTime: lisbon("2026-08-13T20:40:00"),
    endTime: lisbon("2026-08-13T21:40:00"),
    notes: null,
    recommended: true,
    stageId: "palco2",
  },
];

describe("StageGrid", () => {
  it("renders one block per performance, positioned by its own stage column", () => {
    const { container } = render(
      <StageGrid stages={stages} performances={performances} isStarred={() => false} onToggleStar={() => {}} />,
    );

    expect(screen.getByText("Cass McCombs")).toBeInTheDocument();
    expect(screen.getByText("Perfume Genius")).toBeInTheDocument();
    // Window start floors the earliest start (19:40) to 19:00; 19:40 is 40 minutes later, at 2px/min.
    // top/height live on the block's root div, not the star-toggle button nested inside it.
    expect(container.querySelector('[data-performance-id="p1"]')).toHaveStyle({ top: "80px" });
  });

  it("shows an empty-state message instead of a grid when there are no performances", () => {
    render(<StageGrid stages={stages} performances={[]} isStarred={() => false} onToggleStar={() => {}} />);
    expect(screen.getByText(/no performances scheduled/i)).toBeInTheDocument();
  });

  it("calls onToggleStar with the performance id when a block is tapped", async () => {
    const onToggleStar = vi.fn();
    const user = userEvent.setup();
    render(
      <StageGrid stages={stages} performances={performances} isStarred={() => false} onToggleStar={onToggleStar} />,
    );

    await user.click(screen.getByRole("button", { name: /Cass McCombs/ }));
    expect(onToggleStar).toHaveBeenCalledWith("p1");
  });

  it("shows the bolachas-recommends marker only on recommended performances", () => {
    render(
      <StageGrid stages={stages} performances={performances} isStarred={() => false} onToggleStar={() => {}} />,
    );

    // Perfume Genius is recommended (fixture), Cass McCombs is not. The marker
    // is an aria-hidden SVG, so assert on the DOM within each act's button.
    const recommended = screen.getByRole("button", { name: /Perfume Genius/ });
    const notRecommended = screen.getByRole("button", { name: /Cass McCombs/ });
    expect(recommended.querySelector("svg")).toBeInTheDocument();
    expect(notRecommended.querySelector("svg")).not.toBeInTheDocument();
  });

  it("reflects starred state via aria-pressed", () => {
    render(
      <StageGrid
        stages={stages}
        performances={performances}
        isStarred={(id) => id === "p1"}
        onToggleStar={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /Cass McCombs/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Perfume Genius/ })).toHaveAttribute("aria-pressed", "false");
  });
});

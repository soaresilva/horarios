import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SideStageSection } from "./SideStageSection";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Performance, Stage } from "@/lib/schedule-client";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const stage: Stage = { id: "jazz", name: "Jazz na Relva", slug: "jazz-na-relva", order: 5, zoneId: null, address: null };

function performance(overrides: Partial<Performance> = {}): Performance {
  return {
    id: "p1",
    artistName: "Some Totally Unknown Act",
    date: "2026-08-13",
    startTime: lisbon("2026-08-13T18:00:00"),
    endTime: lisbon("2026-08-13T18:30:00"),
    notes: null,
    recommended: false,
    stageId: "jazz",
    artistId: null,
    ...overrides,
  };
}

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

describe("SideStageSection", () => {
  it("renders nothing when there are no performances for the stage", () => {
    const { container } = render(<SideStageSection stage={stage} performances={[]} marks={fakeMarks()} ft={ft} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls marks.cycle with the performance id when a row is tapped", async () => {
    const cycle = vi.fn();
    const user = userEvent.setup();
    render(<SideStageSection stage={stage} performances={[performance()]} marks={fakeMarks({ cycle })} ft={ft} />);

    await user.click(screen.getByRole("button", { name: /Some Totally Unknown Act/ }));
    expect(cycle).toHaveBeenCalledWith("p1");
  });

  it.each<[MarkTier | null, string]>([
    ["must", "must-see"],
    ["interested", "interested"],
    [null, "unmarked"],
  ])("reflects the %s tier via aria-label", (tier, expectedWord) => {
    render(<SideStageSection stage={stage} performances={[performance()]} marks={fakeMarks({ tierOf: () => tier })} ft={ft} />);
    expect(screen.getByRole("button", { name: new RegExp(expectedWord) })).toBeInTheDocument();
  });

  // Pins the claim from the plan: a flex-col row with a single full-width
  // child lays out identically to the old flex-row of the same two
  // children, so the toggle-off render is unchanged.
  it("with showNotes off, the row button has no note-related second line", () => {
    render(
      <SideStageSection
        stage={stage}
        performances={[performance()]}
        marks={fakeMarks({ noteOf: () => "bring earplugs", showNotes: false })}
        ft={ft}
      />,
    );

    const button = screen.getByRole("button", { name: /Some Totally Unknown Act/ });
    expect(button).toHaveClass("flex-col");
    // Exactly one child: the name+time wrapper span. No second (note) child.
    expect(button.children).toHaveLength(1);
    expect(screen.getByTitle("bring earplugs")).toBeInTheDocument();
    expect(screen.queryByText("bring earplugs")).not.toBeInTheDocument();
  });

  it("with showNotes on, shows the note text inline as a second line and drops the ✎", () => {
    render(
      <SideStageSection
        stage={stage}
        performances={[performance()]}
        marks={fakeMarks({ noteOf: () => "bring earplugs", showNotes: true })}
        ft={ft}
      />,
    );

    const button = screen.getByRole("button", { name: /Some Totally Unknown Act/ });
    expect(button.children).toHaveLength(2);
    expect(screen.getByText("bring earplugs")).toBeInTheDocument();
    // No known artist links for this fixture and no recommendation marker,
    // so the only svg that could appear in the icon rail is the ✎ Pencil.
    expect(document.querySelectorAll("svg").length).toBe(0);
  });
});

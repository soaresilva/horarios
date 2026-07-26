import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleEditor } from "./ScheduleEditor";
import { deletePerformanceById } from "@/app/admin/actions";
import type { Performance, Stage } from "@/lib/schedule-client";

// Server actions can't execute under jsdom; stub the module so the component
// renders and we can assert on the delete call.
vi.mock("@/app/admin/actions", () => ({
  saveScheduleAction: vi.fn(async () => ({})),
  deletePerformanceById: vi.fn(async () => {}),
}));

const stages: Stage[] = [{ id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0 }];

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
    recommended: true,
    stageId: "vodafone",
  },
];

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("ScheduleEditor", () => {
  it("renders the whole panel as one form with a single save button", () => {
    render(<ScheduleEditor stages={stages} performances={performances} />);
    expect(screen.getAllByRole("button", { name: "Save all changes" })).toHaveLength(1);
    expect(document.querySelectorAll("form")).toHaveLength(1);
  });

  it("prefills an existing performance's fields, including the recommended checkbox", () => {
    render(<ScheduleEditor stages={stages} performances={performances} />);
    expect(screen.getByDisplayValue("Cass McCombs")).toBeInTheDocument();
    // The recommended checkbox for this row is pre-checked.
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.some((c) => (c as HTMLInputElement).checked)).toBe(true);
  });

  it("deletes a performance only after the user confirms", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<ScheduleEditor stages={stages} performances={performances} />);

    await user.click(screen.getByRole("button", { name: /Delete Cass McCombs/ }));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(deletePerformanceById).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /Delete Cass McCombs/ }));
    expect(deletePerformanceById).toHaveBeenCalledWith("p1");
  });
});

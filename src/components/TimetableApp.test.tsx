import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimetableApp } from "./TimetableApp";
import { useSchedule } from "@/hooks/useSchedule";
import type { Schedule } from "@/lib/schedule-client";

// TimetableApp pulls in a wide tree of child components (install prompts,
// day tabs, the stage grid...) with their own browser-API dependencies
// (matchMedia, localStorage). None of that is what's under test here — only
// the loading/error/schedule branching at the top of the component — so
// every child is stubbed to keep the test focused and fast.
vi.mock("@/hooks/useSchedule");
vi.mock("@/hooks/useStarred", () => ({ useStarred: () => ({ isStarred: () => false, toggle: () => {} }) }));
vi.mock("@/components/DayTabs", () => ({ DayTabs: () => null }));
vi.mock("@/components/InstallBanner", () => ({ InstallBanner: () => null }));
vi.mock("@/components/RecommendationsToggle", () => ({ RecommendationsToggle: () => null }));
vi.mock("@/components/SideStageSection", () => ({ SideStageSection: () => null }));
vi.mock("@/components/SocialLinks", () => ({ SocialLinks: () => null }));
vi.mock("@/components/StageGrid", () => ({ StageGrid: () => null }));

const mockUseSchedule = vi.mocked(useSchedule);

const schedule: Schedule = {
  updatedAt: new Date("2026-08-13T18:00:00Z"),
  stages: [{ id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0 }],
  performances: [
    {
      id: "p1",
      artistName: "Cass McCombs",
      date: "2026-08-13",
      startTime: new Date("2026-08-13T18:40:00Z"),
      endTime: new Date("2026-08-13T19:45:00Z"),
      notes: null,
      recommended: false,
      stageId: "vodafone",
    },
  ],
};

describe("TimetableApp loading/error states", () => {
  it("shows the full-page error screen when nothing has ever loaded", () => {
    mockUseSchedule.mockReturnValue({ schedule: null, loading: false, error: "boom", reload: vi.fn() });
    render(<TimetableApp />);
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  // Regression for: the 2026-08-05 refetch-on-focus/60s-poll feature made
  // background refetch failures far more frequent than the original
  // mount-only fetch ever risked (any signal blip during a poll or tab
  // focus, plausible on festival grounds). The render gate used to be
  // `if (error || !schedule)`, which replaced the whole already-working
  // page with an error screen on any such blip, discarding a perfectly
  // good previously-loaded schedule still sitting in state.
  it("keeps showing the already-loaded schedule when a background refetch fails, instead of blanking the page", () => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: "Couldn't load the schedule.", reload: vi.fn() });
    render(<TimetableApp />);

    // The real timetable UI is still up...
    expect(screen.getByText("Horários Bolachas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();

    // ...with a small, non-blocking notice instead of a full-page takeover.
    expect(screen.getByRole("button", { name: /refresh failed/i })).toBeInTheDocument();
  });

  it("shows no stale-refresh notice once a refetch succeeds again", () => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: vi.fn() });
    render(<TimetableApp />);
    expect(screen.queryByRole("button", { name: /refresh failed/i })).not.toBeInTheDocument();
  });
});

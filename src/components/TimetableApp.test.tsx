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

// The 10-11 Aug shape: two stages pair up in the main grid, so both of their
// names have to appear in the sticky header above it.
const pairedSchedule: Schedule = {
  updatedAt: new Date("2026-08-10T18:00:00Z"),
  stages: [
    { id: "sobe-a-vila", name: "Sobe à Vila", slug: "sobe-a-vila", order: 2 },
    { id: "xapas-lounge", name: "Xapas Lounge", slug: "xapas-lounge", order: 5 },
  ],
  performances: [
    {
      id: "p1",
      artistName: "Alex Moon",
      date: "2026-08-10",
      startTime: new Date("2026-08-10T21:30:00Z"),
      endTime: new Date("2026-08-10T23:00:00Z"),
      notes: null,
      recommended: false,
      stageId: "sobe-a-vila",
    },
    {
      id: "p2",
      artistName: "Rufia Terno",
      date: "2026-08-10",
      startTime: new Date("2026-08-10T21:30:00Z"),
      endTime: new Date("2026-08-11T03:00:00Z"),
      notes: null,
      recommended: false,
      stageId: "xapas-lounge",
    },
  ],
};

describe("TimetableApp main-stage header", () => {
  // Regression for a reported bug where "Xapas Lounge" was missing from the
  // header until the visitor switched to another day and back.
  it("labels every paired main stage, not just the first", () => {
    mockUseSchedule.mockReturnValue({ schedule: pairedSchedule, loading: false, error: null, reload: vi.fn() });
    render(<TimetableApp />);

    expect(screen.getByText("Sobe à Vila")).toBeInTheDocument();
    expect(screen.getByText("Xapas Lounge")).toBeInTheDocument();
  });

  // The blurred backdrop was what made Safari stutter while scrolling (it
  // recomputes the backdrop every frame for a sticky element inside a
  // scroll container) and what left the header text unpainted on first
  // render. The background is opaque instead, so the blur buys nothing —
  // if it comes back, both bugs come back with it.
  it("keeps the sticky header opaque rather than backdrop-blurred", () => {
    mockUseSchedule.mockReturnValue({ schedule: pairedSchedule, loading: false, error: null, reload: vi.fn() });
    const { container } = render(<TimetableApp />);

    const stickies = container.querySelectorAll(".sticky");
    expect(stickies.length).toBeGreaterThan(0);
    for (const el of stickies) {
      expect(el.className).not.toMatch(/backdrop-blur/);
      expect(el.className).not.toMatch(/will-change/);
    }
  });
});

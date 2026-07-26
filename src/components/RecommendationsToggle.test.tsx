import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecommendationsToggle } from "./RecommendationsToggle";
import { StageGrid } from "./StageGrid";
import type { Performance, Stage } from "@/lib/schedule-client";

afterEach(() => {
  window.localStorage.clear();
});

const stages: Stage[] = [{ id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0 }];

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const performances: Performance[] = [
  {
    id: "p1",
    artistName: "Perfume Genius",
    date: "2026-08-13",
    startTime: lisbon("2026-08-13T20:40:00"),
    endTime: lisbon("2026-08-13T21:40:00"),
    notes: null,
    recommended: true,
    stageId: "vodafone",
  },
];

function marker() {
  return screen.getByRole("button", { name: /Perfume Genius/ }).querySelector("svg");
}

describe("RecommendationsToggle", () => {
  it("starts on (aria-checked true) and flips on click", async () => {
    const user = userEvent.setup();
    render(<RecommendationsToggle />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("hides the recommendation markers on the grid when switched off, and restores them", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RecommendationsToggle />
        <StageGrid stages={stages} performances={performances} isStarred={() => false} onToggleStar={() => {}} />
      </>,
    );

    expect(marker()).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));
    expect(marker()).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch"));
    expect(marker()).toBeInTheDocument();
  });
});

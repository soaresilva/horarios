import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerformanceBlock } from "./PerformanceBlock";
import type { Performance } from "@/lib/schedule-client";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const layout = { top: 0, height: 90 };

function performance(overrides: Partial<Performance> = {}): Performance {
  return {
    id: "p1",
    artistName: "Wet Leg",
    date: "2026-08-12",
    startTime: lisbon("2026-08-12T23:05:00"),
    endTime: lisbon("2026-08-13T00:20:00"),
    notes: null,
    recommended: false,
    stageId: "vodafone",
    ...overrides,
  };
}

describe("PerformanceBlock", () => {
  it("renders Spotify and Instagram links for an artist that has both, opening in a new tab", () => {
    render(
      <PerformanceBlock
        performance={performance()}
        layout={layout}
        alternate={false}
        starred={false}
        showRecommendation={false}
        onToggleStar={() => {}}
      />,
    );

    const spotify = screen.getByRole("link", { name: "Wet Leg on Spotify" });
    expect(spotify).toHaveAttribute("href", expect.stringMatching(/^https:\/\/open\.spotify\.com\/artist\//));
    expect(spotify).toHaveAttribute("target", "_blank");
    expect(spotify).toHaveAttribute("rel", "noopener noreferrer");

    const instagram = screen.getByRole("link", { name: "Wet Leg on Instagram" });
    expect(instagram).toHaveAttribute("href", expect.stringMatching(/^https:\/\/www\.instagram\.com\//));
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders only the Spotify link for an artist with no known Instagram", () => {
    render(
      <PerformanceBlock
        performance={performance({ artistName: "Ryan Davis and the Roadhouse Band" })}
        layout={layout}
        alternate={false}
        starred={false}
        showRecommendation={false}
        onToggleStar={() => {}}
      />,
    );

    expect(screen.getByRole("link", { name: /on Spotify/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /on Instagram/ })).not.toBeInTheDocument();
  });

  it("renders no links for an artist with no entry (just the star)", () => {
    render(
      <PerformanceBlock
        performance={performance({ artistName: "Wu Lyf" })}
        layout={layout}
        alternate={false}
        starred={false}
        showRecommendation={false}
        onToggleStar={() => {}}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("toggles the star when the block body is clicked", async () => {
    const onToggleStar = vi.fn();
    const user = userEvent.setup();
    render(
      <PerformanceBlock
        performance={performance()}
        layout={layout}
        alternate={false}
        starred={false}
        showRecommendation={false}
        onToggleStar={onToggleStar}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Wet Leg/ }));
    expect(onToggleStar).toHaveBeenCalledWith("p1");
  });

  // The core interaction requirement: the links are siblings of the star
  // button (not nested inside it, which would be invalid HTML and would let
  // a link click bubble into the toggle). Clicking a link must never also
  // toggle the star.
  it("does not toggle the star when a link is clicked", async () => {
    const onToggleStar = vi.fn();
    const user = userEvent.setup();
    render(
      <PerformanceBlock
        performance={performance()}
        layout={layout}
        alternate={false}
        starred={false}
        showRecommendation={false}
        onToggleStar={onToggleStar}
      />,
    );

    await user.click(screen.getByRole("link", { name: "Wet Leg on Spotify" }));
    expect(onToggleStar).not.toHaveBeenCalled();
  });
});

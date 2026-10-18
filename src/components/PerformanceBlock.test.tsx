import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerformanceBlock } from "./PerformanceBlock";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Artist, Performance } from "@/lib/schedule-client";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const layout = { offset: 0, extent: 90 };

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
    artistId: null, series: null, host: null, kind: "CONCERT",
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

describe("PerformanceBlock", () => {
  it("renders Spotify and Instagram links for an artist that has both, opening in a new tab", () => {
    render(<PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks()} ft={ft} showRecommendation={false} />);

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
        performance={performance({ artistName: "Rita Cortezão" })}
        layout={layout}
        alternate={false}
        marks={fakeMarks()}
        ft={ft}
        showRecommendation={false}
      />,
    );

    expect(screen.getByRole("link", { name: /on Spotify/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /on Instagram/ })).not.toBeInTheDocument();
  });

  it("renders no links for an artist with no entry (just the star)", () => {
    render(
      <PerformanceBlock
        performance={performance({ artistName: "Some Totally Unknown Act" })}
        layout={layout}
        alternate={false}
        marks={fakeMarks()}
        ft={ft}
        showRecommendation={false}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("cycles the tier when the block body is clicked", async () => {
    const cycle = vi.fn();
    const user = userEvent.setup();
    render(<PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ cycle })} ft={ft} showRecommendation={false} />);

    await user.click(screen.getByRole("button", { name: /Wet Leg/ }));
    expect(cycle).toHaveBeenCalledWith("p1");
  });

  // The core interaction requirement: the links are siblings of the cycle
  // button (not nested inside it, which would be invalid HTML and would let
  // a link click bubble into the cycle). Clicking a link must never also
  // cycle the tier.
  it("does not cycle the tier when a link is clicked", async () => {
    const cycle = vi.fn();
    const user = userEvent.setup();
    render(<PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ cycle })} ft={ft} showRecommendation={false} />);

    await user.click(screen.getByRole("link", { name: "Wet Leg on Spotify" }));
    expect(cycle).not.toHaveBeenCalled();
  });

  it.each<[MarkTier | null, string]>([
    ["must", "must-see"],
    ["interested", "interested"],
    [null, "unmarked"],
  ])("describes the %s tier in the block's aria-label", (tier, expectedWord) => {
    render(<PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ tierOf: () => tier })} ft={ft} showRecommendation={false} />);
    expect(screen.getByRole("button", { name: new RegExp(expectedWord) })).toBeInTheDocument();
  });

  it("renders amber interested styling distinct from must-see", () => {
    const { container: interestedContainer } = render(
      <PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ tierOf: () => "interested" })} ft={ft} showRecommendation={false} />,
    );
    expect(interestedContainer.querySelector('[data-performance-id="p1"]')?.className).toMatch(/bg-interested/);

    const { container: mustContainer } = render(
      <PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ tierOf: () => "must" })} ft={ft} showRecommendation={false} />,
    );
    expect(mustContainer.querySelector('[data-performance-id="p1"]')?.className).toMatch(/bg-accent/);
  });

  it("shows the note (✎) indicator only when a note exists, with the note text as its tooltip", () => {
    const { container: withNote } = render(
      <PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ noteOf: () => "front left" })} ft={ft} showRecommendation={false} />,
    );
    expect(withNote.querySelector('[title="front left"]')).toBeInTheDocument();

    const { container: withoutNote } = render(
      <PerformanceBlock performance={performance()} layout={layout} alternate={false} marks={fakeMarks({ noteOf: () => "" })} ft={ft} showRecommendation={false} />,
    );
    expect(withoutNote.querySelector("[title]")).not.toBeInTheDocument();
  });

  describe("display notes toggle", () => {
    it("with showNotes off, shows only the ✎ indicator, never the note text", () => {
      render(
        <PerformanceBlock
          performance={performance()}
          layout={layout}
          alternate={false}
          marks={fakeMarks({ noteOf: () => "front left, get there early", showNotes: false })}
          ft={ft}
          showRecommendation={false}
        />,
      );

      expect(screen.getByTitle("front left, get there early")).toBeInTheDocument();
      expect(screen.queryByText("front left, get there early")).not.toBeInTheDocument();
    });

    it("with showNotes on and a tall block, shows the note text inline and drops the ✎", () => {
      // No known artist links, so the only possible svg in the rail is the
      // ✎ Pencil — isolates the assertion to just that icon disappearing.
      render(
        <PerformanceBlock
          performance={performance({ artistName: "Some Totally Unknown Act" })}
          layout={layout}
          alternate={false}
          marks={fakeMarks({ noteOf: () => "front left, get there early", showNotes: true })}
          ft={ft}
          showRecommendation={false}
        />,
      );

      expect(screen.getByText("front left, get there early")).toBeInTheDocument();
      expect(document.querySelectorAll("svg").length).toBe(0);
    });

    it("with showNotes on but a 40px (20-min) block, keeps the ✎ and renders no inline text — too short to hold a line", () => {
      render(
        <PerformanceBlock
          performance={performance()}
          layout={{ offset: 0, extent: 40 }}
          alternate={false}
          marks={fakeMarks({ noteOf: () => "front left, get there early", showNotes: true })}
          ft={ft}
          showRecommendation={false}
        />,
      );

      expect(screen.getByTitle("front left, get there early")).toBeInTheDocument();
      expect(screen.queryByText("front left, get there early")).not.toBeInTheDocument();
    });
  });

  describe("with an imported artist (London Calling)", () => {
    const artist: Artist = {
      id: "lc26oct-a-lip-critic",
      name: "Lip Critic",
      country: null,
      genres: null,
      spotifyUrl: "https://open.spotify.com/artist/4ABuKdLlVyzLztIFR8ETX9",
      instagramUrl: null,
      sourceUrl: "https://www.londoncalling.nl/artists/lip-critic/",
    };

    it("links the name to the act's festival page and takes Spotify from the artist row", () => {
      render(
        <PerformanceBlock
          performance={performance({ artistName: "Lip Critic", artistId: artist.id })}
          artist={artist}
          layout={layout}
          alternate={false}
          marks={fakeMarks()}
          ft={ft}
          showRecommendation={false}
        />,
      );
      const name = screen.getByRole("link", { name: "Lip Critic" });
      expect(name).toHaveAttribute("href", "https://www.londoncalling.nl/artists/lip-critic/");
      expect(name).toHaveAttribute("target", "_blank");
      expect(screen.getByRole("link", { name: "Lip Critic on Spotify" })).toHaveAttribute("href", artist.spotifyUrl);
      expect(screen.queryByRole("link", { name: "Lip Critic on Instagram" })).not.toBeInTheDocument();
    });

    it("never mixes in the hand-written PdC links, even for a name that has some", () => {
      render(
        <PerformanceBlock
          performance={performance({ artistName: "Wet Leg" })}
          artist={{ ...artist, name: "Wet Leg", spotifyUrl: null, sourceUrl: null }}
          layout={layout}
          alternate={false}
          marks={fakeMarks()}
          ft={ft}
          showRecommendation={false}
        />,
      );
      expect(screen.queryByRole("link", { name: "Wet Leg on Spotify" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Wet Leg on Instagram" })).not.toBeInTheDocument();
    });

    it("a tap on the name link doesn't cycle the mark; a tap on the block still does", async () => {
      const cycle = vi.fn();
      render(
        <PerformanceBlock
          performance={performance({ artistName: "Lip Critic", artistId: artist.id })}
          artist={artist}
          layout={layout}
          alternate={false}
          marks={fakeMarks({ cycle })}
          ft={ft}
          showRecommendation={false}
        />,
      );
      await userEvent.click(screen.getByRole("link", { name: "Lip Critic" }));
      expect(cycle).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: /Lip Critic/ }));
      expect(cycle).toHaveBeenCalledWith("p1");
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransposedPerformanceBlock } from "./TransposedPerformanceBlock";
import { programmeCopy } from "@/lib/festival-copy";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Artist, Performance } from "@/lib/schedule-client";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const layout = { offset: 0, extent: 200 };

function performance(overrides: Partial<Performance> = {}): Performance {
  return {
    id: "p1",
    artistName: "Some Totally Unknown Act",
    date: "2026-10-23",
    startTime: lisbon("2026-10-23T20:20:00"),
    endTime: lisbon("2026-10-23T21:00:00"),
    notes: null,
    recommended: false,
    stageId: "annabel-up",
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

function renderBlock(overrides: Partial<MarkControls> = {}, artist: Artist | undefined = undefined) {
  return render(
    <TransposedPerformanceBlock
      performance={performance()}
      artist={artist}
      layout={layout}
      links={{}}
      marks={fakeMarks(overrides)}
      showRecommendation={false}
      ordinal={undefined}
      isOrigin={false}
      programme={programmeCopy("lotd26")}
      ft={ft}
      onSelectOrigin={() => {}}
    />,
  );
}

const crewFriends = [
  { tag: "D", colorIndex: 0, tier: "must" as const, note: "front left" },
  { tag: "M", colorIndex: 1, tier: "must" as const },
  { tag: "Zs", colorIndex: 2, tier: "interested" as const },
  { tag: "J", colorIndex: 3, tier: "interested" as const },
];

describe("TransposedPerformanceBlock", () => {
  it("calls onSelectOrigin with the performance id when the block body is tapped", async () => {
    const onSelectOrigin = vi.fn();
    const user = userEvent.setup();
    render(
      <TransposedPerformanceBlock
        performance={performance()}
        artist={undefined}
        layout={layout}
        links={{}}
        marks={fakeMarks()}
        showRecommendation={false}
        ordinal={undefined}
        isOrigin={false}
        programme={programmeCopy("lotd26")}
        ft={ft}
        onSelectOrigin={onSelectOrigin}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Measure walking times/ }));
    expect(onSelectOrigin).toHaveBeenCalledWith("p1");
  });

  it.each<[MarkTier | null, string]>([
    ["must", "must-see"],
    ["interested", "interested"],
    [null, "unmarked"],
  ])("reflects the %s tier via the rail star's aria-label", (tier, expectedWord) => {
    renderBlock({ tierOf: () => tier });
    expect(screen.getByRole("button", { name: new RegExp(expectedWord) })).toBeInTheDocument();
  });

  describe("display notes toggle", () => {
    it("with showNotes off, shows only the ✎ indicator, never the note text", () => {
      renderBlock({ noteOf: () => "sounds like Bikini Kill", showNotes: false });

      expect(screen.getByTitle("sounds like Bikini Kill")).toBeInTheDocument();
      expect(screen.queryByText("sounds like Bikini Kill")).not.toBeInTheDocument();
    });

    it("with showNotes on, shows the note text inline and drops the ✎", () => {
      renderBlock({ noteOf: () => "sounds like Bikini Kill", showNotes: true });

      expect(screen.getByText("sounds like Bikini Kill")).toBeInTheDocument();
      // No known artist links (empty `links` prop) and no ordinal, so the
      // only svg that could appear here is the ✎ Pencil.
      expect(document.querySelectorAll("svg").length).toBe(0);
    });

    it("with no note at all, showNotes on renders neither the ✎ nor inline text", () => {
      renderBlock({ noteOf: () => "", showNotes: true });
      expect(document.querySelectorAll("svg").length).toBe(0);
      expect(screen.queryByTitle(/./)).not.toBeInTheDocument();
    });
  });
});

describe("TransposedPerformanceBlock side programme", () => {
  function renderWith(p: Performance, marks: Partial<MarkControls> = {}) {
    return render(
      <TransposedPerformanceBlock
        performance={p}
        artist={undefined}
        layout={layout}
        links={{}}
        marks={fakeMarks(marks)}
        showRecommendation={false}
        ordinal={undefined}
        isOrigin={false}
        programme={programmeCopy("lotd26")}
        ft={ft}
        onSelectOrigin={() => {}}
      />,
    );
  }

  it("shows a FREE chip, dashed outline and host tooltip for a side-programme set", () => {
    const { container } = renderWith(
      performance({ series: "The Official Unofficial", host: "Sour Grapes" }),
    );
    expect(screen.getByText("FREE")).toBeInTheDocument();
    const block = container.querySelector("[data-performance-id]")!;
    expect(block.className).toContain("border-dashed");
    expect(block.getAttribute("title")).toBe("The Official Unofficial · hosted by Sour Grapes · free entry");
  });

  it("shows no chip or outline for a main-programme set", () => {
    const { container } = renderWith(performance());
    expect(screen.queryByText("FREE")).not.toBeInTheDocument();
    const block = container.querySelector("[data-performance-id]")!;
    expect(block.className).not.toContain("border-dashed");
    expect(block.hasAttribute("title")).toBe(false);
  });

  it("lets a tier ring win over the dashed outline once the set is marked", () => {
    const { container } = renderWith(performance({ series: "The Official Unofficial" }), {
      tierOf: () => "must" as MarkTier,
    });
    const block = container.querySelector("[data-performance-id]")!;
    expect(block.className).toContain("ring-accent");
    expect(block.className).not.toContain("border-dashed");
    // Still identifiable as free while marked.
    expect(screen.getByText("FREE")).toBeInTheDocument();
  });
});

describe("TransposedPerformanceBlock on Le Guess Who?", () => {
  function renderLgw(p: Performance) {
    return render(
      <TransposedPerformanceBlock
        performance={p}
        artist={undefined}
        layout={layout}
        links={{}}
        marks={fakeMarks()}
        showRecommendation={false}
        ordinal={undefined}
        isOrigin={false}
        programme={programmeCopy("lgw26")}
        ft={ft}
        onSelectOrigin={() => {}}
      />,
    );
  }

  it("marks a U? set with a dashed U? chip and no free-entry claim", () => {
    const { container } = renderLgw(performance({ series: "U?", host: "Curated by Perry Gits" }));
    expect(screen.getByText("U?")).toBeInTheDocument();
    expect(screen.queryByText("FREE")).toBeNull();
    const block = container.querySelector("[data-performance-id]")!;
    expect(block.className).toContain("border-dashed");
    expect(block.getAttribute("title")).toBe("U? · Curated by Perry Gits");
  });

  it("names a non-concert with a solid kind chip", () => {
    const { container } = renderLgw(performance({ kind: "EXHIBITION" }));
    expect(screen.getByText("EXPO")).toBeInTheDocument();
    expect(container.querySelector("[data-performance-id]")!.getAttribute("title")).toBe("Exhibition");
  });

  it("shows a curated project as the tooltip on a main-programme concert, with no chip", () => {
    const { container } = renderLgw(performance({ host: "Curated by aja monet" }));
    expect(screen.queryByText("U?")).toBeNull();
    expect(screen.queryByText("EXPO")).toBeNull();
    const block = container.querySelector("[data-performance-id]")!;
    expect(block.className).not.toContain("border-dashed");
    expect(block.getAttribute("title")).toBe("Curated by aja monet");
  });

  it("shows two friends' tags then +N on the clock line, and a tap opens the sheet, not the walking origin", async () => {
    const openSheet = vi.fn();
    const user = userEvent.setup();
    const { container } = renderBlock({ friendsOf: () => crewFriends, openSheet });
    expect([...container.querySelectorAll("[data-crew-tag]")].map((el) => el.textContent)).toEqual(["D", "M"]);
    expect(screen.getByText("+2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Crew:/ }));
    expect(openSheet).toHaveBeenCalledWith("p1");
    expect(screen.getByRole("button", { name: /Measure walking times/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("puts each friend's note in the bubbles' hover text", () => {
    renderBlock({ friendsOf: () => crewFriends });
    expect(screen.getByRole("button", { name: /^Crew:/ })).toHaveAttribute(
      "title",
      "D: must-see · front left\nM: must-see\nZs: interested\nJ: interested",
    );
  });
});

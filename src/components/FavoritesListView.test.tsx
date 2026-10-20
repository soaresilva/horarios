import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FavoritesListView } from "./FavoritesListView";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Performance, Stage, ZoneWalk } from "@/lib/schedule-client";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

const stages: Stage[] = [
  { id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0, zoneId: null, address: null },
  { id: "palco2", name: "Palco 2", slug: "palco-2", order: 1, zoneId: null, address: null },
];

const zonedStages: Stage[] = [
  { id: "worm1", name: "Worm 1", slug: "worm-1", order: 0, zoneId: "eendrachtsplein", address: "Boomgaardsstraat 71" },
  { id: "kunsthal", name: "Kunsthal", slug: "kunsthal", order: 1, zoneId: "museumpark", address: "Westzeedijk 341" },
];

const zoneWalks: ZoneWalk[] = [{ fromZoneId: "eendrachtsplein", toZoneId: "museumpark", minutes: 12 }];

function performance(overrides: Partial<Performance>): Performance {
  return {
    id: "p1",
    artistName: "Cass McCombs",
    date: "2026-08-13",
    startTime: lisbon("2026-08-13T19:40:00"),
    endTime: lisbon("2026-08-13T20:45:00"),
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

function tierOfMap(map: Record<string, MarkTier>) {
  return (id: string): MarkTier | null => map[id] ?? null;
}

describe("FavoritesListView", () => {
  it("shows an empty-state message instead of a list when nothing is marked", () => {
    render(
      <FavoritesListView
        performances={[performance({})]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks()}
        ft={ft}
      />,
    );
    expect(screen.getByText(/no marks yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Cass McCombs")).not.toBeInTheDocument();
  });

  it("renders only marked performances (either tier), chronologically regardless of input order", () => {
    const later = performance({ id: "p2", artistName: "Perfume Genius", startTime: lisbon("2026-08-13T22:00:00"), endTime: lisbon("2026-08-13T23:00:00"), stageId: "palco2" });
    const earlier = performance({ id: "p1", artistName: "Cass McCombs" });
    const unmarked = performance({ id: "p3", artistName: "Not Marked", startTime: lisbon("2026-08-13T18:00:00"), endTime: lisbon("2026-08-13T18:30:00") });

    render(
      <FavoritesListView
        // Deliberately out of chronological order in the input array.
        performances={[later, earlier, unmarked]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: tierOfMap({ p1: "must", p2: "interested" }) })}
        ft={ft}
      />,
    );

    expect(screen.queryByText("Not Marked")).not.toBeInTheDocument();
    const names = screen.getAllByText(/Cass McCombs|Perfume Genius/).map((el) => el.textContent);
    expect(names).toEqual(["Cass McCombs", "Perfume Genius"]);
  });

  it("marks consecutive shows at the same stage as the same venue, with no walk time", () => {
    const first = performance({ id: "p1", artistName: "Cass McCombs" });
    const second = performance({
      id: "p2",
      artistName: "Perfume Genius",
      startTime: lisbon("2026-08-13T21:00:00"),
      endTime: lisbon("2026-08-13T22:00:00"),
      stageId: "vodafone",
    });

    render(
      <FavoritesListView
        performances={[first, second]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: () => "must" })}
        ft={ft}
      />,
    );

    expect(screen.getByText("same venue")).toBeInTheDocument();
  });

  it("shows the measured zone-to-zone walking time between two different venues", () => {
    const first = performance({ id: "p1", artistName: "Cass McCombs", stageId: "worm1" });
    const second = performance({
      id: "p2",
      artistName: "Perfume Genius",
      startTime: lisbon("2026-08-13T21:00:00"),
      endTime: lisbon("2026-08-13T22:00:00"),
      stageId: "kunsthal",
    });

    render(
      <FavoritesListView
        performances={[first, second]}
        stages={zonedStages}
        zoneWalks={zoneWalks}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: () => "must" })}
        ft={ft}
      />,
    );

    expect(screen.getByText("12 min walk")).toBeInTheDocument();
  });

  // PdC has no zones at all, so this is the common case there: two
  // different stages with nothing honest to say about the distance between
  // them, so nothing is shown rather than a guess.
  it("shows no walk time between two different venues with no zone data", () => {
    const first = performance({ id: "p1", artistName: "Cass McCombs", stageId: "vodafone" });
    const second = performance({
      id: "p2",
      artistName: "Perfume Genius",
      startTime: lisbon("2026-08-13T21:00:00"),
      endTime: lisbon("2026-08-13T22:00:00"),
      stageId: "palco2",
    });

    render(
      <FavoritesListView
        performances={[first, second]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: () => "must" })}
        ft={ft}
      />,
    );

    expect(screen.queryByText(/min walk/)).not.toBeInTheDocument();
    expect(screen.queryByText("same venue")).not.toBeInTheDocument();
  });

  it("calls marks.cycle with the performance id when a row's star is tapped", async () => {
    const cycle = vi.fn();
    render(
      <FavoritesListView
        performances={[performance({})]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: () => "must", cycle })}
        ft={ft}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /mark cass mccombs/i }));
    expect(cycle).toHaveBeenCalledWith("p1");
  });

  it("renders the note text under the time/stage line when one exists", () => {
    render(
      <FavoritesListView
        performances={[performance({})]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: () => "must", noteOf: () => "front left, get there early" })}
        ft={ft}
      />,
    );

    expect(screen.getByText("front left, get there early")).toBeInTheDocument();
  });

  it("tints an interested row differently from a must-see row", () => {
    const { container } = render(
      <FavoritesListView
        performances={[performance({})]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        marks={fakeMarks({ tierOf: () => "interested" })}
        ft={ft}
      />,
    );

    expect(container.querySelector(".bg-interested\\/15")).toBeInTheDocument();
  });

  describe("crew", () => {
    const mine = performance({ id: "mine", artistName: "Mine", stageId: "worm1" });
    const theirs = performance({
      id: "theirs",
      artistName: "Theirs Only",
      stageId: "kunsthal",
      startTime: lisbon("2026-08-13T21:00:00"),
      endTime: lisbon("2026-08-13T21:40:00"),
    });
    const mineLater = performance({
      id: "mine-later",
      artistName: "Mine Later",
      stageId: "kunsthal",
      startTime: lisbon("2026-08-13T22:00:00"),
      endTime: lisbon("2026-08-13T22:40:00"),
    });
    const friendsOf = (id: string) =>
      id === "theirs"
        ? [{ tag: "M", colorIndex: 1, tier: "must" as const, note: "meet by the sound desk" }]
        : id === "mine"
          ? [{ tag: "Zs", colorIndex: 2, tier: "interested" as const }]
          : [];
    const crewMarks = fakeMarks({ tierOf: tierOfMap({ mine: "must", "mine-later": "interested" }), friendsOf });

    function renderList(crewSets?: { show: boolean; toggle: () => void }) {
      return render(
        <FavoritesListView
          performances={[mine, theirs, mineLater]}
          stages={zonedStages}
          zoneWalks={zoneWalks}
          artistsById={new Map()}
          ordinals={new Map()}
          marks={crewMarks}
          ft={ft}
          crewSets={crewSets}
        />,
      );
    }

    it("shows friends' bubbles on your own sets, and no crew-only sets while the switch is off", () => {
      const { container } = renderList({ show: false, toggle: () => {} });
      expect(screen.queryByText("Theirs Only")).toBeNull();
      expect(container.querySelector('[data-performance-id="mine"] [data-crew-tag="Zs"]')).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /crew picks/ })).toHaveAttribute("aria-checked", "false");
    });

    it("adds crew-only sets, dimmed, with the friend's note, when the switch is on", () => {
      const { container } = renderList({ show: true, toggle: () => {} });
      const row = container.querySelector('[data-performance-id="theirs"]')!;
      expect(row).toHaveAttribute("data-crew-only", "true");
      expect(row.querySelector(".border-dashed")).toBeInTheDocument();
      expect(row).toHaveTextContent("M: meet by the sound desk");
    });

    it("measures the walk between your own sets, skipping the crew-only one in between", () => {
      renderList({ show: true, toggle: () => {} });
      // mine (Worm 1, Eendrachtsplein) → mine-later (Kunsthal, Museumpark) is 12 min,
      // and the crew-only Kunsthal set between them gets no walk line of its own.
      expect(screen.getAllByText(/min walk|same venue|same building/)).toEqual([screen.getByText("12 min walk")]);
    });

    it("has no switch when there's no crew", () => {
      renderList(undefined);
      expect(screen.queryByRole("switch", { name: /crew picks/ })).toBeNull();
    });

    it("points to the switch from the empty state when only friends picked sets", () => {
      render(
        <FavoritesListView
          performances={[theirs]}
          stages={zonedStages}
          zoneWalks={zoneWalks}
          artistsById={new Map()}
          ordinals={new Map()}
          marks={fakeMarks({ friendsOf })}
          ft={ft}
          crewSets={{ show: false, toggle: () => {} }}
        />,
      );
      expect(screen.getByText(/Your crew picked 1 set: switch on crew picks/)).toBeInTheDocument();
    });
  });
});

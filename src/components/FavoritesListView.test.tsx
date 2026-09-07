import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FavoritesListView } from "./FavoritesListView";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { Performance, Stage, ZoneWalk } from "@/lib/schedule-client";

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
    artistId: null,
    ...overrides,
  };
}

describe("FavoritesListView", () => {
  it("shows an empty-state message instead of a list when nothing is starred", () => {
    render(
      <FavoritesListView
        performances={[performance({})]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        isStarred={() => false}
        ft={ft}
        onToggleStar={() => {}}
      />,
    );
    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
    expect(screen.queryByText("Cass McCombs")).not.toBeInTheDocument();
  });

  it("renders only starred performances, chronologically regardless of input order", () => {
    const later = performance({ id: "p2", artistName: "Perfume Genius", startTime: lisbon("2026-08-13T22:00:00"), endTime: lisbon("2026-08-13T23:00:00"), stageId: "palco2" });
    const earlier = performance({ id: "p1", artistName: "Cass McCombs" });
    const unstarred = performance({ id: "p3", artistName: "Not Starred", startTime: lisbon("2026-08-13T18:00:00"), endTime: lisbon("2026-08-13T18:30:00") });

    render(
      <FavoritesListView
        // Deliberately out of chronological order in the input array.
        performances={[later, earlier, unstarred]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        isStarred={(id) => id === "p1" || id === "p2"}
        ft={ft}
        onToggleStar={() => {}}
      />,
    );

    expect(screen.queryByText("Not Starred")).not.toBeInTheDocument();
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
        isStarred={() => true}
        ft={ft}
        onToggleStar={() => {}}
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
        isStarred={() => true}
        ft={ft}
        onToggleStar={() => {}}
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
        isStarred={() => true}
        ft={ft}
        onToggleStar={() => {}}
      />,
    );

    expect(screen.queryByText(/min walk/)).not.toBeInTheDocument();
    expect(screen.queryByText("same venue")).not.toBeInTheDocument();
  });

  it("calls onToggleStar with the performance id when a row's star is tapped", async () => {
    const onToggleStar = vi.fn();
    render(
      <FavoritesListView
        performances={[performance({})]}
        stages={stages}
        zoneWalks={[]}
        artistsById={new Map()}
        ordinals={new Map()}
        isStarred={() => true}
        ft={ft}
        onToggleStar={onToggleStar}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /star cass mccombs/i }));
    expect(onToggleStar).toHaveBeenCalledWith("p1");
  });
});

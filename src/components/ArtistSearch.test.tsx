import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SearchField, SearchResults } from "./ArtistSearch";
import type { MarkControls, MarkTier } from "@/hooks/useMarks";
import type { Performance, Stage } from "@/lib/schedule-client";

const ft = { timezone: "Europe/Amsterdam", locale: "en-GB" };

const stages: Stage[] = [
  { id: "rotown", name: "Rotown", slug: "rotown", order: 0, zoneId: null, address: null },
  { id: "worm", name: "WORM", slug: "worm", order: 1, zoneId: null, address: null },
];

const base = { notes: null, recommended: false, artistId: null, host: null, series: null, kind: "CONCERT" as const };
const results: Performance[] = [
  { ...base, id: "aug1", date: "2026-10-23", stageId: "rotown", artistName: "August", startTime: new Date("2026-10-23T18:00:00Z"), endTime: new Date("2026-10-23T18:40:00Z") },
  { ...base, id: "aug2", date: "2026-10-24", stageId: "worm", artistName: "August", startTime: new Date("2026-10-24T11:00:00Z"), endTime: new Date("2026-10-24T11:40:00Z"), series: "touo" },
];

function marksWith({ tiers = {}, hidden = [] }: { tiers?: Record<string, MarkTier>; hidden?: string[] } = {}): MarkControls {
  return {
    tierOf: (id) => tiers[id] ?? null,
    noteOf: () => "",
    cycle: () => {},
    setTier: () => {},
    setNote: () => {},
    openSheet: () => {},
    showNotes: false,
    actHidden: (id) => hidden.includes(id),
  };
}

function renderResults(props: Partial<Parameters<typeof SearchResults>[0]> = {}) {
  return render(
    <SearchResults
      query="aug"
      results={results}
      stages={stages}
      marks={marksWith()}
      sideTag="free daytime"
      ft={ft}
      onSelect={() => {}}
      {...props}
    />,
  );
}

describe("SearchResults", () => {
  it("gives each set its day, time and room", () => {
    renderResults();
    const rows = within(screen.getByRole("list", { name: "Search results" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("FRI 23");
    expect(rows[0]).toHaveTextContent("20:00–20:40 · Rotown");
    expect(rows[1]).toHaveTextContent("SAT 24");
    expect(rows[1]).toHaveTextContent("13:00–13:40 · WORM · free daytime");
  });

  it("shows the visitor's tier on a marked set", () => {
    renderResults({ marks: marksWith({ tiers: { aug1: "must", aug2: "interested" } }) });
    expect(screen.getByLabelText("must-see")).toBeInTheDocument();
    expect(screen.getByLabelText("interested")).toBeInTheDocument();
  });

  it("lists a hidden act's sets, dimmed", () => {
    renderResults({ marks: marksWith({ hidden: ["aug1"] }) });
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveAttribute("data-hidden", "true");
    expect(rows[0]).toHaveClass("opacity-40");
    expect(rows[1]).not.toHaveAttribute("data-hidden");
  });

  it("strikes a cancelled set's name rather than dropping it", () => {
    renderResults({ results: [{ ...results[0], artistName: "[cancelled] August" }] });
    expect(screen.getByText("[cancelled]")).toBeInTheDocument();
    expect(screen.getByText("August")).toHaveClass("line-through");
  });

  it("hands the tapped set's id to onSelect", async () => {
    const onSelect = vi.fn();
    renderResults({ onSelect });
    await userEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith("aug2");
  });

  it("says so when nothing matches", () => {
    renderResults({ query: " zzz ", results: [] });
    expect(screen.getByText("No act matches “zzz”.")).toBeInTheDocument();
  });
});

describe("SearchField", () => {
  function Controlled() {
    const [query, setQuery] = useState("");
    return <SearchField query={query} onChange={setQuery} />;
  }

  it("offers a clear button only once something is typed, and it empties the field", async () => {
    render(<Controlled />);
    const input = screen.getByRole("searchbox", { name: "Search acts" });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    await userEvent.type(input, "aug");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("clears on Escape", async () => {
    render(<Controlled />);
    const input = screen.getByRole("searchbox", { name: "Search acts" });
    await userEvent.type(input, "aug{Escape}");
    expect(input).toHaveValue("");
  });

  it("uses a 16px font on phones so iOS doesn't zoom in on focus", () => {
    render(<Controlled />);
    expect(screen.getByRole("searchbox")).toHaveClass("text-base");
  });
});

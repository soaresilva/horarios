import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimetableApp } from "./TimetableApp";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import { useSchedule } from "@/hooks/useSchedule";
import type { Schedule } from "@/lib/schedule-client";

// TimetableApp pulls in a wide tree of child components (install prompts,
// day tabs, the stage grid...) with their own browser-API dependencies
// (matchMedia, localStorage). None of that is what's under test here — only
// the loading/error/schedule branching at the top of the component — so
// every child is stubbed to keep the test focused and fast.
vi.mock("@/hooks/useSchedule");
// The real useFavoritesSync imports server-only Server Actions, so it's
// swapped for the plain localStorage store it wraps (useMarks). Unsynced
// marking and hiding behave identically through either, and the hide tests
// below get real state to drive.
vi.mock("@/hooks/useFavoritesSync", async () => {
  const { useMarks } = await import("@/hooks/useMarks");
  return {
    useFavoritesSync: (festivalSlug: string) => ({
      ...useMarks(festivalSlug),
      synced: false,
      startSync: async () => {},
      generateCode: async () => ({ error: "not mocked" }),
      redeemCode: async () => ({ error: "invalid" as const }),
    }),
  };
});
// Crews: the real hook imports the crew Server Actions (server-only). Inert
// here; the button is a marker so its per-festival gating is observable.
vi.mock("@/hooks/useCrew", () => ({
  useCrew: () => ({
    crew: null,
    fetchedAt: null,
    friendsOf: () => [],
    create: async () => ({ error: "invalid" as const }),
    join: async () => ({ error: "invalid" as const }),
    update: async () => ({ error: "invalid" as const }),
    leave: async () => {},
  }),
}));
vi.mock("@/components/CrewButton", () => ({ CrewButton: () => <span>CREW BUTTON</span> }));
vi.mock("@/components/DayTabs", () => ({ DayTabs: () => null }));
vi.mock("@/components/FavoritesListView", () => ({ FavoritesListView: () => <div>FAVORITES LIST VIEW</div> }));
vi.mock("@/components/InstallBanner", () => ({ InstallBanner: () => null }));
vi.mock("@/components/RecommendationsToggle", () => ({ RecommendationsToggle: () => null }));
vi.mock("@/components/SideStageSection", () => ({ SideStageSection: () => null }));
vi.mock("@/components/SocialLinks", () => ({ SocialLinks: () => null }));
vi.mock("@/components/StageGrid", () => ({ StageGrid: () => null }));
vi.mock("@/components/SyncFavoritesButton", () => ({ SyncFavoritesButton: () => null }));
// Lists what it was handed, so the side-programme switch's filtering is
// observable without rendering the real two-axis grid. Each row also carries
// the block's two gestures as text-free buttons (so toHaveTextContent checks
// above are unaffected): "hold" opens MarkSheet, "tap" cycles the tier.
vi.mock("@/components/TransposedGrid", () => ({
  TransposedGrid: ({
    performances,
    marks,
  }: {
    performances: { id: string; artistName: string }[];
    marks: import("@/hooks/useMarks").MarkControls;
  }) => (
    <ul aria-label="transposed grid">
      {performances.map((p) => (
        <li key={p.id} data-testid={p.id} data-hidden={marks.actHidden?.(p.id) ? "true" : undefined}>
          {p.artistName}
          <button type="button" aria-label={`hold ${p.id}`} onClick={() => marks.openSheet(p.id)} />
          <button type="button" aria-label={`tap ${p.id}`} onClick={() => marks.cycle(p.id)} />
        </li>
      ))}
    </ul>
  ),
}));
// Real enough to drive from a test: a single button that flips grid<->list,
// rather than the actual two-pill control — TimetableApp's own branching on
// `view` is what's under test here, not ViewToggle's own rendering (that has
// its own test file).
vi.mock("@/components/ViewToggle", () => ({
  ViewToggle: ({ view, onChange }: { view: "grid" | "list"; onChange: (v: "grid" | "list") => void }) => (
    <button onClick={() => onChange(view === "grid" ? "list" : "grid")}>toggle view</button>
  ),
}));

const mockUseSchedule = vi.mocked(useSchedule);

const schedule: Schedule = {
  zones: [],
  zoneWalks: [],
  artists: [],
  artistsById: new Map(),
  updatedAt: new Date("2026-08-13T18:00:00Z"),
  stages: [{ id: "vodafone", name: "Vodafone", slug: "vodafone", order: 0, zoneId: null, address: null }],
  performances: [
    {
      id: "p1",
      artistName: "Cass McCombs",
      date: "2026-08-13",
      startTime: new Date("2026-08-13T18:40:00Z"),
      endTime: new Date("2026-08-13T19:45:00Z"),
      notes: null,
      recommended: false,
      stageId: "vodafone", artistId: null, series: null, host: null, kind: "CONCERT",
    },
  ],
};

describe("TimetableApp loading/error states", () => {
  it("shows the full-page error screen when nothing has ever loaded", () => {
    mockUseSchedule.mockReturnValue({ schedule: null, loading: false, error: "boom", reload: vi.fn() });
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);
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
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);

    // The real timetable UI is still up...
    expect(screen.getByText("Horários Bolachas")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    // ...with a way back to the archive index at "/", now that this
    // component only renders under /pdc26 rather than at the site root.
    expect(screen.getByRole("link", { name: /Horários archive/ })).toHaveAttribute("href", "/");

    // ...with a small, non-blocking notice instead of a full-page takeover.
    expect(screen.getByRole("button", { name: /refresh failed/i })).toBeInTheDocument();
  });

  it("shows no stale-refresh notice once a refetch succeeds again", () => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: vi.fn() });
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);
    expect(screen.queryByRole("button", { name: /refresh failed/i })).not.toBeInTheDocument();
  });
});

// The 10-11 Aug shape: two stages pair up in the main grid, so both of their
// names have to appear in the sticky header above it.
const pairedSchedule: Schedule = {
  zones: [],
  zoneWalks: [],
  artists: [],
  artistsById: new Map(),
  updatedAt: new Date("2026-08-10T18:00:00Z"),
  stages: [
    { id: "sobe-a-vila", name: "Sobe à Vila", slug: "sobe-a-vila", order: 2, zoneId: null, address: null },
    { id: "xapas-lounge", name: "Xapas Lounge", slug: "xapas-lounge", order: 5, zoneId: null, address: null },
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
      stageId: "sobe-a-vila", artistId: null, series: null, host: null, kind: "CONCERT",
    },
    {
      id: "p2",
      artistName: "Rufia Terno",
      date: "2026-08-10",
      startTime: new Date("2026-08-10T21:30:00Z"),
      endTime: new Date("2026-08-11T03:00:00Z"),
      notes: null,
      recommended: false,
      stageId: "xapas-lounge", artistId: null, series: null, host: null, kind: "CONCERT",
    },
  ],
};

describe("TimetableApp view toggle", () => {
  it("shows the grid by default and swaps to the favorites list view when toggled", async () => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: vi.fn() });
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);

    expect(screen.queryByText("FAVORITES LIST VIEW")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "toggle view" }));
    expect(screen.getByText("FAVORITES LIST VIEW")).toBeInTheDocument();
  });
});

describe("TimetableApp main-stage header", () => {
  // Regression for a reported bug where "Xapas Lounge" was missing from the
  // header until the visitor switched to another day and back.
  it("labels every paired main stage, not just the first", () => {
    mockUseSchedule.mockReturnValue({ schedule: pairedSchedule, loading: false, error: null, reload: vi.fn() });
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);

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
    const { container } = render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);

    const stickies = container.querySelectorAll(".sticky");
    expect(stickies.length).toBeGreaterThan(0);
    for (const el of stickies) {
      expect(el.className).not.toMatch(/backdrop-blur/);
      expect(el.className).not.toMatch(/will-change/);
    }
  });
});

describe("TimetableApp side programme switch", () => {
  const lotdFt = { timezone: "Europe/Amsterdam", locale: "en-GB" };
  const base = {
    date: "2026-10-23",
    notes: null,
    recommended: false,
    stageId: "rotown",
    artistId: null,
    host: null,
    kind: "CONCERT" as const,
  };
  const lotdSchedule: Schedule = {
    ...schedule,
    stages: [{ id: "rotown", name: "Rotown", slug: "rotown", order: 0, zoneId: null, address: null }],
    performances: [
      {
        ...base,
        id: "touo",
        artistName: "Painkiller (daytime)",
        startTime: new Date("2026-10-23T10:00:00Z"),
        endTime: new Date("2026-10-23T10:45:00Z"),
        series: "The Official Unofficial",
        host: "Canned Pineapple",
      },
      {
        ...base,
        id: "main",
        artistName: "August",
        startTime: new Date("2026-10-23T14:00:00Z"),
        endTime: new Date("2026-10-23T14:40:00Z"),
        series: null,
      },
    ],
  };

  it("shows side-programme sets by default and hides them when switched off", async () => {
    window.localStorage.clear();
    mockUseSchedule.mockReturnValue({ schedule: lotdSchedule, loading: false, error: null, reload: () => {} });
    render(<TimetableApp festivalSlug="lotd26" ft={lotdFt} layout="TRANSPOSED" />);

    const grid = screen.getByRole("list", { name: "transposed grid" });
    expect(grid).toHaveTextContent("Painkiller (daytime)");
    expect(grid).toHaveTextContent("August");

    const toggle = screen.getByRole("switch", { name: /daytime shows/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(grid).not.toHaveTextContent("Painkiller (daytime)");
    expect(grid).toHaveTextContent("August");
    window.localStorage.clear();
  });

  it("doesn't offer the switch for a festival without a side programme", () => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: () => {} });
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);
    expect(screen.queryByRole("switch", { name: /daytime shows/ })).toBeNull();
  });
});

describe("TimetableApp Le Guess Who? switches", () => {
  const lgwFt = { timezone: "Europe/Amsterdam", locale: "en-GB" };
  const base = {
    date: "2026-11-08",
    notes: null,
    recommended: false,
    stageId: "basis",
    artistId: null,
    host: null,
    series: null,
    kind: "CONCERT" as const,
  };
  const lgwSchedule: Schedule = {
    ...schedule,
    stages: [{ id: "basis", name: "BASIS", slug: "basis", order: 0, zoneId: null, address: null }],
    performances: [
      { ...base, id: "concert", artistName: "Yerai Cortés", startTime: new Date("2026-11-08T15:00:00Z"), endTime: new Date("2026-11-08T16:10:00Z") },
      { ...base, id: "u", artistName: "Woody Grooves", series: "U?", startTime: new Date("2026-11-08T17:00:00Z"), endTime: new Date("2026-11-08T18:00:00Z") },
      { ...base, id: "expo", artistName: "MUSCLE by Karimah Ashadu", kind: "EXHIBITION" as const, startTime: new Date("2026-11-08T10:00:00Z"), endTime: new Date("2026-11-08T16:00:00Z") },
      { ...base, id: "u-other", artistName: "Community dinner", series: "U?", kind: "OTHER" as const, startTime: new Date("2026-11-08T17:00:00Z"), endTime: new Date("2026-11-08T18:30:00Z") },
    ],
  };

  function renderLgw() {
    mockUseSchedule.mockReturnValue({ schedule: lgwSchedule, loading: false, error: null, reload: () => {} });
    render(<TimetableApp festivalSlug="lgw26" ft={lgwFt} layout="TRANSPOSED" />);
    return screen.getByRole("list", { name: "transposed grid" });
  }

  it("opens on the main concert programme only: U? and non-concerts are opt-in", () => {
    window.localStorage.clear();
    const grid = renderLgw();
    expect(grid).toHaveTextContent("Yerai Cortés");
    expect(grid).not.toHaveTextContent("Woody Grooves");
    expect(grid).not.toHaveTextContent("MUSCLE");
    expect(grid).not.toHaveTextContent("Community dinner");
    expect(screen.getByRole("switch", { name: /U\? programme/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: /films, talks/ })).toHaveAttribute("aria-checked", "false");
  });

  it("applies the two switches independently, and a U? non-concert needs both", async () => {
    window.localStorage.clear();
    const grid = renderLgw();

    await userEvent.click(screen.getByRole("switch", { name: /U\? programme/ }));
    expect(grid).toHaveTextContent("Woody Grooves");
    expect(grid).not.toHaveTextContent("Community dinner");
    expect(grid).not.toHaveTextContent("MUSCLE");

    await userEvent.click(screen.getByRole("switch", { name: /films, talks/ }));
    expect(grid).toHaveTextContent("Community dinner");
    expect(grid).toHaveTextContent("MUSCLE");

    await userEvent.click(screen.getByRole("switch", { name: /U\? programme/ }));
    expect(grid).not.toHaveTextContent("Woody Grooves");
    expect(grid).not.toHaveTextContent("Community dinner");
    expect(grid).toHaveTextContent("MUSCLE");
    expect(window.localStorage.getItem("lgw26:showSideProgramme")).toBe("false");
    expect(window.localStorage.getItem("lgw26:showNonConcerts")).toBe("true");
    window.localStorage.clear();
  });

  it("remembers a visitor's choice across reloads", () => {
    window.localStorage.clear();
    window.localStorage.setItem("lgw26:showSideProgramme", "true");
    const grid = renderLgw();
    expect(grid).toHaveTextContent("Woody Grooves");
    window.localStorage.clear();
  });

  it("offers no non-concerts switch for a festival that has none", () => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: () => {} });
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);
    expect(screen.queryByRole("switch", { name: /films, talks/ })).toBeNull();
  });
});

describe("TimetableApp help text switch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: vi.fn() });
  });

  it("shows the mark hint and the legend by default, and hides them when switched off", async () => {
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);

    expect(screen.getByText(/tap a set to mark it/i)).toBeInTheDocument();
    expect(screen.getByText("tap to change")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: /help text/ }));

    expect(screen.queryByText(/tap a set to mark it/i)).not.toBeInTheDocument();
    expect(screen.queryByText("tap to change")).not.toBeInTheDocument();
    // The switch itself and the recommends control are not help text.
    expect(screen.getByRole("switch", { name: /help text/ })).toHaveAttribute("aria-checked", "false");
    expect(window.localStorage.getItem("app:showHelp")).toBe("false");
  });

  it("hides the whole blurb with it: facts, how-to and links", async () => {
    render(<TimetableApp festivalSlug="lc26oct" ft={ft} layout="VERTICAL" />);

    expect(screen.getByText(/Times from the official poster/)).toBeInTheDocument();
    expect(screen.getByText(/Tap a show once/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "londoncalling.nl" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: /help text/ }));

    expect(screen.queryByText(/Times from the official poster/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap a show once/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "londoncalling.nl" })).not.toBeInTheDocument();
  });

  it("hides a festival's disclaimer even when it has no help copy", () => {
    window.localStorage.setItem("app:showHelp", "false");
    render(<TimetableApp festivalSlug="pdc26" ft={ft} layout="VERTICAL" />);

    expect(screen.getByRole("switch", { name: /help text/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText(/End times are estimated/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Playlist" })).not.toBeInTheDocument();
  });
});

describe("TimetableApp crews", () => {
  beforeEach(() => {
    mockUseSchedule.mockReturnValue({ schedule, loading: false, error: null, reload: vi.fn() });
  });

  it("shows the crew button on Left of the Dial", () => {
    render(<TimetableApp festivalSlug="lotd26" ft={ft} layout="TRANSPOSED" />);
    expect(screen.getByText("CREW BUTTON")).toBeInTheDocument();
  });

  it.each(["pdc26", "lc26oct", "lgw26"])("has no crew button on %s, where crews are off", (slug) => {
    render(<TimetableApp festivalSlug={slug} ft={ft} layout="VERTICAL" />);
    expect(screen.queryByText("CREW BUTTON")).toBeNull();
  });
});

describe("TimetableApp hidden acts", () => {
  const lotdFt = { timezone: "Europe/Amsterdam", locale: "en-GB" };
  const base = {
    date: "2026-10-23",
    notes: null,
    recommended: false,
    artistId: null,
    host: null,
    series: null,
    kind: "CONCERT" as const,
  };
  // August plays twice on the day in two different rooms, so hiding from
  // one set has to reach the other.
  const hideSchedule: Schedule = {
    ...schedule,
    stages: [
      { id: "rotown", name: "Rotown", slug: "rotown", order: 0, zoneId: null, address: null },
      { id: "worm", name: "WORM", slug: "worm", order: 1, zoneId: null, address: null },
    ],
    performances: [
      { ...base, id: "aug1", stageId: "rotown", artistName: "August", startTime: new Date("2026-10-23T18:00:00Z"), endTime: new Date("2026-10-23T18:40:00Z") },
      { ...base, id: "aug2", stageId: "worm", artistName: "August", startTime: new Date("2026-10-23T21:00:00Z"), endTime: new Date("2026-10-23T21:40:00Z") },
      { ...base, id: "gordi", stageId: "rotown", artistName: "Gordi", startTime: new Date("2026-10-23T19:00:00Z"), endTime: new Date("2026-10-23T19:40:00Z") },
    ],
  };

  beforeEach(() => {
    window.localStorage.clear();
    mockUseSchedule.mockReturnValue({ schedule: hideSchedule, loading: false, error: null, reload: () => {} });
  });

  function renderLotd() {
    render(<TimetableApp festivalSlug="lotd26" ft={lotdFt} layout="TRANSPOSED" />);
    return screen.getByRole("list", { name: "transposed grid" });
  }

  it("offers no switch until something is hidden", () => {
    renderLotd();
    expect(screen.queryByRole("switch", { name: /show hidden acts/i })).toBeNull();
  });

  it("hides every set by the act from the sheet, and the switch brings them back dimmed", async () => {
    const grid = renderLotd();
    await userEvent.click(screen.getByRole("button", { name: "hold aug1" }));
    const hideButton = screen.getByRole("button", { name: /hide this act/i });
    expect(hideButton).toHaveTextContent("(all 2 sets)");
    await userEvent.click(hideButton);

    // Both sets gone (including the one on another stage), sheet closed.
    expect(within(grid).queryByTestId("aug1")).toBeNull();
    expect(within(grid).queryByTestId("aug2")).toBeNull();
    expect(grid).toHaveTextContent("Gordi");
    expect(screen.queryByRole("button", { name: /hide this act/i })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("lotd26:hidden") ?? "[]")).toEqual(["name:august"]);

    const toggle = screen.getByRole("switch", { name: "Show hidden acts (1)" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);

    expect(within(grid).getByTestId("aug1")).toHaveAttribute("data-hidden", "true");
    expect(within(grid).getByTestId("aug2")).toHaveAttribute("data-hidden", "true");
    expect(within(grid).getByTestId("gordi")).not.toHaveAttribute("data-hidden");
  });

  it("unhiding from the sheet restores the act and turns the switch back off", async () => {
    window.localStorage.setItem("lotd26:hidden", JSON.stringify(["name:august"]));
    window.localStorage.setItem("lotd26:showHidden", "true");
    const grid = renderLotd();

    await userEvent.click(screen.getByRole("button", { name: "hold aug2" }));
    await userEvent.click(screen.getByRole("button", { name: /unhide this act/i }));

    expect(within(grid).getByTestId("aug1")).not.toHaveAttribute("data-hidden");
    expect(within(grid).getByTestId("aug2")).not.toHaveAttribute("data-hidden");
    expect(window.localStorage.getItem("lotd26:hidden")).toBeNull();
    // Nothing left hidden, so the switch is off and gone: hiding the next
    // act takes it off the grid instead of just dimming it.
    expect(window.localStorage.getItem("lotd26:showHidden")).toBe("false");
    expect(screen.queryByRole("switch", { name: /show hidden acts/i })).toBeNull();
  });

  it("hiding clears the act's marks, so a must-see set doesn't keep it on the grid", async () => {
    window.localStorage.setItem("lotd26:starred", JSON.stringify(["aug1"]));
    window.localStorage.setItem("lotd26:notes", JSON.stringify({ aug1: "maybe" }));
    const grid = renderLotd();

    await userEvent.click(screen.getByRole("button", { name: "hold aug1" }));
    await userEvent.click(screen.getByRole("button", { name: /hide this act/i }));

    expect(within(grid).queryByTestId("aug1")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("lotd26:starred") ?? "[]")).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("lotd26:notes") ?? "{}")).toEqual({ aug1: "maybe" });
  });

  it("marking a dimmed set unhides its act", async () => {
    window.localStorage.setItem("lotd26:hidden", JSON.stringify(["name:august"]));
    window.localStorage.setItem("lotd26:showHidden", "true");
    const grid = renderLotd();

    await userEvent.click(within(grid).getByRole("button", { name: "tap aug1" }));

    expect(JSON.parse(window.localStorage.getItem("lotd26:starred") ?? "[]")).toEqual(["aug1"]);
    expect(within(grid).getByTestId("aug2")).not.toHaveAttribute("data-hidden");
    expect(window.localStorage.getItem("lotd26:hidden")).toBeNull();
  });

  // A pairing merge can bring a mark from one device and a hide from the
  // other. The marked set stays; the act's other set doesn't.
  it("keeps a marked set of a hidden act on the grid, dimmed", () => {
    window.localStorage.setItem("lotd26:hidden", JSON.stringify(["name:august"]));
    window.localStorage.setItem("lotd26:starred", JSON.stringify(["aug2"]));
    const grid = renderLotd();

    expect(within(grid).getByTestId("aug2")).toHaveAttribute("data-hidden", "true");
    expect(within(grid).queryByTestId("aug1")).toBeNull();
  });

  it("ignores a hidden key no act on this festival matches", () => {
    window.localStorage.setItem("lotd26:hidden", JSON.stringify(["name:renamed since"]));
    const grid = renderLotd();
    expect(grid).toHaveTextContent("August");
    expect(screen.queryByRole("switch", { name: /show hidden acts/i })).toBeNull();
  });
});

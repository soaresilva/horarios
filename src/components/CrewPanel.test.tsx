import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrewPanel } from "./CrewPanel";
import type { UseCrewResult } from "@/hooks/useCrew";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { CrewDTO, CrewResult } from "@/types/crew";

const lgw: CrewDTO = {
  id: "crew-1",
  code: "KX7PQ2",
  name: "LGW gang",
  me: { tag: "D", colorIndex: 0, shareNotes: true },
  members: [
    { tag: "M", colorIndex: 1 },
    { tag: "Zs", colorIndex: 2 },
  ],
};
const porto: CrewDTO = {
  id: "crew-2",
  code: "BH53RW",
  name: null,
  me: { tag: "Di", colorIndex: 1, shareNotes: false },
  members: [{ tag: "F", colorIndex: 0 }],
};

const ok = (...crews: CrewDTO[]): CrewResult => ({ crews: { crews, friends: [] } });

function fakeCrew(overrides: Partial<UseCrewResult> = {}): UseCrewResult {
  return {
    crews: [],
    friends: [],
    fetchedAt: null,
    friendsOf: () => [],
    crewLabelOf: () => null,
    hiddenCrewIds: new Set(),
    toggleCrewHidden: vi.fn(),
    create: vi.fn(async () => ok(lgw)),
    join: vi.fn(async () => ok(lgw)),
    update: vi.fn(async () => ok(lgw)),
    rename: vi.fn(async () => ok(lgw)),
    leave: vi.fn(async () => {}),
    ...overrides,
  };
}

function renderPanel(crew: UseCrewResult, onClose = () => {}) {
  return render(<CrewPanel crew={crew} festivalSlug="lgw26" ft={ft} onClose={onClose} />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CrewPanel, no crews yet", () => {
  it("starts a crew with the typed tag and name", async () => {
    const crew = fakeCrew();
    const user = userEvent.setup();
    renderPanel(crew);

    await user.type(screen.getByLabelText("Your tag"), "D");
    await user.type(screen.getByLabelText("Crew name"), "LGW gang");
    await user.click(screen.getByRole("button", { name: "Start a crew" }));
    expect(crew.create).toHaveBeenCalledWith("D", "LGW gang");
  });

  it("joins with the code and tag, and says what joining shares", async () => {
    const crew = fakeCrew();
    const user = userEvent.setup();
    renderPanel(crew);

    expect(screen.getByText(/shares your must-see and interested marks, and your notes/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your tag"), "M");
    await user.type(screen.getByLabelText("Crew code"), "kx7-pq2");
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(crew.join).toHaveBeenCalledWith("kx7-pq2", "M");
  });

  it.each([
    ["invalid", "No crew with that code."],
    ["full", "That crew is full (15 people)."],
    ["tag-taken", "Zs is taken in this crew, pick another tag."],
    ["bad-tag", "Your tag must be 1 or 2 letters or digits."],
    ["too-many-crews", "You're in 5 crews already. Leave one first."],
  ] as const)("shows the %s error in words", async (error, message) => {
    const crew = fakeCrew({ join: vi.fn(async () => ({ error })) });
    const user = userEvent.setup();
    renderPanel(crew);

    await user.type(screen.getByLabelText("Your tag"), "Zs");
    await user.type(screen.getByLabelText("Crew code"), "KX7PQ2");
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });

  it("says so when the server can't be reached", async () => {
    const crew = fakeCrew({ create: vi.fn(async () => Promise.reject(new Error("offline"))) });
    const user = userEvent.setup();
    renderPanel(crew);

    await user.type(screen.getByLabelText("Your tag"), "D");
    await user.click(screen.getByRole("button", { name: "Start a crew" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Couldn't reach the server/);
  });
});

describe("CrewPanel, in crews", () => {
  it("lists every crew with one open, showing its people, you first", () => {
    renderPanel(fakeCrew({ crews: [lgw, porto] }));
    expect(screen.getByText("KX7-PQ2")).toBeInTheDocument();
    expect(screen.getByText("BH5-3RW")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Crew members" })).toHaveTextContent(/^Dyou\s*M\s*Zs$/);
  });

  it("shows an unnamed crew's code where its name would be", () => {
    renderPanel(fakeCrew({ crews: [porto] }));
    expect(screen.getByRole("button", { name: /BH5-3RW/ }).firstElementChild).toHaveTextContent("BH5-3RW");
  });

  it("limits its height to the room left on screen, so nothing ends up unreachable", () => {
    renderPanel(fakeCrew({ crews: [lgw, porto] }));
    expect(screen.getByRole("dialog", { name: "Crews" }).style.maxHeight).toBe(`${window.innerHeight - 12}px`);
  });

  it("opening another crew closes the first", async () => {
    const user = userEvent.setup();
    renderPanel(fakeCrew({ crews: [lgw, porto] }));

    await user.click(screen.getByRole("button", { name: /BH5-3RW/ }));
    expect(screen.getAllByRole("list", { name: "Crew members" })).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Crew members" })).toHaveTextContent(/^Diyou\s*F$/);
    expect(screen.getByRole("button", { name: /BH5-3RW/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /KX7-PQ2/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("fits a full crew of 15 as wrapping chips", () => {
    const full = { ...lgw, members: Array.from({ length: 14 }, (_, i) => ({ tag: `${i}`, colorIndex: i + 1 })) };
    renderPanel(fakeCrew({ crews: [full] }));
    const list = screen.getByRole("list", { name: "Crew members" });
    expect(list.children).toHaveLength(15);
    expect(list).toHaveClass("flex-wrap");
  });

  it("copies the open crew's code", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderPanel(fakeCrew({ crews: [lgw, porto] }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("KX7-PQ2");
    expect(await screen.findByRole("status")).toHaveTextContent("Code copied.");
  });

  it("switches a crew off the grid, for that crew only", async () => {
    const crew = fakeCrew({ crews: [lgw, porto] });
    const user = userEvent.setup();
    renderPanel(crew);
    const toggle = screen.getByRole("switch", { name: "Show on grid" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(crew.toggleCrewHidden).toHaveBeenCalledWith("crew-1");
  });

  it("marks a hidden crew in its header and shows its switch off", () => {
    renderPanel(fakeCrew({ crews: [lgw, porto], hiddenCrewIds: new Set(["crew-1"]) }));
    expect(within(screen.getByRole("button", { name: /KX7-PQ2/ })).getByText("hidden")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show on grid" })).toHaveAttribute("aria-checked", "false");
  });

  it("switches note sharing off for the open crew", async () => {
    const crew = fakeCrew({ crews: [lgw, porto] });
    const user = userEvent.setup();
    renderPanel(crew);
    const toggle = screen.getByRole("switch", { name: "Share my notes" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(crew.update).toHaveBeenCalledWith("crew-1", { shareNotes: false });
  });

  it("saves a new tag, and only once it differs", async () => {
    const crew = fakeCrew({ crews: [lgw] });
    const user = userEvent.setup();
    renderPanel(crew);
    const save = screen.getByRole("button", { name: "Save tag" });
    expect(save).toBeDisabled();
    await user.clear(screen.getByLabelText("Your tag"));
    await user.type(screen.getByLabelText("Your tag"), "Di");
    await user.click(save);
    expect(crew.update).toHaveBeenCalledWith("crew-1", { tag: "Di" });
  });

  it("saves a new name, and only once it differs", async () => {
    const crew = fakeCrew({ crews: [lgw] });
    const user = userEvent.setup();
    renderPanel(crew);
    const save = screen.getByRole("button", { name: "Save name" });
    expect(save).toBeDisabled();
    await user.clear(screen.getByLabelText("Crew name"));
    await user.type(screen.getByLabelText("Crew name"), "Utrecht");
    await user.click(save);
    expect(crew.rename).toHaveBeenCalledWith("crew-1", "Utrecht");
  });

  it("picks up a rename from a friend rather than keeping a stale draft", () => {
    const { rerender } = renderPanel(fakeCrew({ crews: [lgw] }));
    rerender(
      <CrewPanel crew={fakeCrew({ crews: [{ ...lgw, name: "Utrecht" }] })} festivalSlug="lgw26" ft={ft} onClose={() => {}} />,
    );
    expect(screen.getByLabelText("Crew name")).toHaveValue("Utrecht");
  });

  it("asks before leaving, and leaves only the open crew", async () => {
    const crew = fakeCrew({ crews: [lgw, porto] });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPanel(crew);

    await user.click(screen.getByRole("button", { name: "Leave crew" }));
    expect(crew.leave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Leave crew" }));
    expect(crew.leave).toHaveBeenCalledTimes(1);
    expect(crew.leave).toHaveBeenCalledWith("crew-1");
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("offers another crew with your tag ready, and lands on the new one", async () => {
    const crew = fakeCrew({ crews: [lgw], join: vi.fn(async () => ok(lgw, porto)) });
    const user = userEvent.setup();
    const { rerender } = renderPanel(crew);

    await user.click(screen.getByRole("button", { name: "+ Start or join another" }));
    expect(screen.getByLabelText("Your tag")).toHaveValue("D");
    await user.type(screen.getByLabelText("Crew code"), "BH5-3RW");
    await user.click(screen.getByRole("button", { name: "Join" }));

    // useCrew's store update, which the real hook does before join resolves.
    rerender(<CrewPanel crew={{ ...crew, crews: [lgw, porto] }} festivalSlug="lgw26" ft={ft} onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: /BH5-3RW/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("has a way back from the form", async () => {
    const user = userEvent.setup();
    renderPanel(fakeCrew({ crews: [lgw] }));
    await user.click(screen.getByRole("button", { name: "+ Start or join another" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("list", { name: "Crew members" })).toBeInTheDocument();
  });

  it("stops offering another crew at the limit", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ ...lgw, id: `crew-${i}`, code: `AAAAA${i + 2}` }));
    renderPanel(fakeCrew({ crews: five }));
    expect(screen.queryByRole("button", { name: "+ Start or join another" })).toBeNull();
    expect(screen.getByText("5 crews is the limit.")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel(fakeCrew({ crews: [lgw] }), onClose);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

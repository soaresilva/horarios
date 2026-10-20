import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrewPanel } from "./CrewPanel";
import type { UseCrewResult } from "@/hooks/useCrew";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";
import type { CrewDTO } from "@/types/crew";

const inCrew: CrewDTO = {
  code: "KX7PQ2",
  me: { tag: "D", colorIndex: 0, shareNotes: true },
  members: [
    { tag: "M", colorIndex: 1, marks: {} },
    { tag: "Zs", colorIndex: 2, marks: {} },
  ],
};

function fakeCrew(overrides: Partial<UseCrewResult> = {}): UseCrewResult {
  return {
    crew: null,
    fetchedAt: null,
    friendsOf: () => [],
    create: vi.fn(async () => ({ crew: inCrew })),
    join: vi.fn(async () => ({ crew: inCrew })),
    update: vi.fn(async () => ({ crew: inCrew })),
    leave: vi.fn(async () => {}),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CrewPanel, not in a crew", () => {
  it("starts a crew with the typed tag", async () => {
    const crew = fakeCrew();
    const user = userEvent.setup();
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);

    await user.type(screen.getByLabelText("Your tag"), "D");
    await user.click(screen.getByRole("button", { name: "Start a crew" }));
    expect(crew.create).toHaveBeenCalledWith("D");
  });

  it("joins with the code and tag, and says what joining shares", async () => {
    const crew = fakeCrew();
    const user = userEvent.setup();
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);

    expect(screen.getByText(/shares your must-see and interested marks, and your notes/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your tag"), "M");
    await user.type(screen.getByLabelText("Crew code"), "kx7-pq2");
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(crew.join).toHaveBeenCalledWith("kx7-pq2", "M");
  });

  it.each([
    ["invalid", "No crew with that code."],
    ["full", "That crew is full (8 people)."],
    ["tag-taken", "Zs is taken in this crew, pick another tag."],
    ["bad-tag", "Your tag must be 1 or 2 letters or digits."],
  ] as const)("shows the %s error in words", async (error, message) => {
    const crew = fakeCrew({ join: vi.fn(async () => ({ error })) });
    const user = userEvent.setup();
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);

    await user.type(screen.getByLabelText("Your tag"), "Zs");
    await user.type(screen.getByLabelText("Crew code"), "KX7PQ2");
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("status")).toHaveTextContent(message);
  });

  it("says so when the server can't be reached", async () => {
    const crew = fakeCrew({ create: vi.fn(async () => Promise.reject(new Error("offline"))) });
    const user = userEvent.setup();
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);

    await user.type(screen.getByLabelText("Your tag"), "D");
    await user.click(screen.getByRole("button", { name: "Start a crew" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Couldn't reach the server/);
  });
});

describe("CrewPanel, in a crew", () => {
  it("shows the code with a dash and everyone in the crew, you first", () => {
    render(<CrewPanel crew={fakeCrew({ crew: inCrew })} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);
    expect(screen.getByText("KX7-PQ2")).toBeInTheDocument();
    const members = screen.getByRole("list", { name: "Crew members" });
    expect(members).toHaveTextContent(/^Dyou\s*M\s*Zs$/);
  });

  it("copies the code", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<CrewPanel crew={fakeCrew({ crew: inCrew })} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("KX7-PQ2");
    expect(await screen.findByRole("status")).toHaveTextContent("Code copied.");
  });

  it("switches note sharing off", async () => {
    const crew = fakeCrew({ crew: inCrew });
    const user = userEvent.setup();
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);
    const toggle = screen.getByRole("switch", { name: /Share my notes/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(crew.update).toHaveBeenCalledWith({ shareNotes: false });
  });

  it("saves a new tag, and only once it differs", async () => {
    const crew = fakeCrew({ crew: inCrew });
    const user = userEvent.setup();
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.clear(screen.getByLabelText("Your tag"));
    await user.type(screen.getByLabelText("Your tag"), "Di");
    await user.click(save);
    expect(crew.update).toHaveBeenCalledWith({ tag: "Di" });
  });

  it("asks before leaving", async () => {
    const crew = fakeCrew({ crew: inCrew });
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<CrewPanel crew={crew} festivalSlug="lotd26" ft={ft} onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Leave crew" }));
    expect(crew.leave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Leave crew" }));
    expect(crew.leave).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CrewPanel crew={fakeCrew({ crew: inCrew })} festivalSlug="lotd26" ft={ft} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkSheet } from "./MarkSheet";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";

function lisbon(iso: string) {
  return new Date(`${iso}+01:00`);
}

function renderSheet(overrides: Partial<React.ComponentProps<typeof MarkSheet>> = {}) {
  const onSetTier = vi.fn();
  const onSetNote = vi.fn();
  const onClose = vi.fn();
  render(
    <MarkSheet
      artistName="Wet Leg"
      startTime={lisbon("2026-08-12T23:05:00")}
      endTime={lisbon("2026-08-13T00:20:00")}
      stageName="Vodafone"
      tier={null}
      note=""
      otherShows={[]}
      ft={ft}
      onSetTier={onSetTier}
      onSetNote={onSetNote}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSetTier, onSetNote, onClose };
}

describe("MarkSheet", () => {
  it("reflects the current tier via aria-pressed", () => {
    renderSheet({ tier: "must" });
    expect(screen.getByRole("button", { name: /Must-see/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Interested/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Clear" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSetTier with the tapped tier", async () => {
    const { onSetTier } = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: /Interested/ }));
    expect(onSetTier).toHaveBeenCalledWith("interested");
  });

  it("calls onSetTier(null) when Clear is tapped", async () => {
    const { onSetTier } = renderSheet({ tier: "must" });
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onSetTier).toHaveBeenCalledWith(null);
  });

  it("calls onSetNote as the visitor types", async () => {
    const { onSetNote } = renderSheet();
    await userEvent.type(screen.getByPlaceholderText(/note/i), "x");
    expect(onSetNote).toHaveBeenCalledWith("x");
  });

  it("lists the act's other sets, with the weekday taken from the festival day", () => {
    renderSheet({
      otherShows: [
        // Festival day 2026-08-13 (a Thursday), starting after midnight: the
        // weekday must come from `date`, not from startTime's calendar day.
        { id: "p2", date: "2026-08-13", startTime: lisbon("2026-08-14T00:20:00"), stageName: "Coura Sem Paredes" },
      ],
    });
    expect(screen.getByText(/Also plays/)).toHaveTextContent("QUI, 00:20 at Coura Sem Paredes");
  });

  it("says nothing about other sets for an act playing once", () => {
    renderSheet();
    expect(screen.queryByText(/Also plays/)).toBeNull();
  });

  it("dismisses on Escape", async () => {
    const { onClose } = renderSheet();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("dismisses on backdrop click", async () => {
    const { onClose } = renderSheet();
    const dialog = screen.getByRole("dialog");
    // The backdrop is the dialog's sibling, not the dialog itself — click it
    // directly rather than the dialog card, which must NOT dismiss.
    const backdrop = dialog.parentElement!.querySelector('[aria-hidden="true"]')!;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("dismisses on Done", async () => {
    const { onClose } = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });
});

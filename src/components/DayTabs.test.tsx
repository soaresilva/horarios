import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayTabs } from "./DayTabs";
import { PDC_FESTIVAL_TIME as ft } from "@/lib/time";

const days = ["2026-08-12", "2026-08-13", "2026-08-14"];

describe("DayTabs", () => {
  it("marks the selected day's tab", () => {
    render(<DayTabs days={days} selected="2026-08-13" today="2026-08-13" ft={ft} onSelect={() => {}} />);
    expect(screen.getByRole("tab", { name: /13/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /12/ })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect with the clicked day", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<DayTabs days={days} selected="2026-08-12" today="2026-08-12" ft={ft} onSelect={onSelect} />);

    await user.click(screen.getByRole("tab", { name: /14/ }));
    expect(onSelect).toHaveBeenCalledWith("2026-08-14");
  });
});

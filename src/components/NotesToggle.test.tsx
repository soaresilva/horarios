import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesToggle } from "./NotesToggle";

describe("NotesToggle", () => {
  it("is a switch whose aria-checked reflects `show`", () => {
    const { rerender } = render(<NotesToggle show={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    rerender(<NotesToggle show={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<NotesToggle show={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpToggle } from "./HelpToggle";

describe("HelpToggle", () => {
  it("is a switch whose aria-checked reflects `show`", () => {
    const { rerender } = render(<HelpToggle show={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch", { name: /help text/ })).toHaveAttribute("aria-checked", "true");

    rerender(<HelpToggle show={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch", { name: /help text/ })).toHaveAttribute("aria-checked", "false");
  });

  it("offers the action the click will perform in its title", () => {
    const { rerender } = render(<HelpToggle show={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("title", "Hide help text");

    rerender(<HelpToggle show={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("title", "Show help text");
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<HelpToggle show={true} onToggle={onToggle} />);

    await user.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  it("marks the current view as pressed and the other as not", () => {
    render(<ViewToggle view="grid" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "My favorites" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the other view when tapped", async () => {
    const onChange = vi.fn();
    render(<ViewToggle view="grid" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "My favorites" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("calling onChange for list flips the pressed state on rerender", async () => {
    const { rerender } = render(<ViewToggle view="list" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "My favorites" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "false");

    rerender(<ViewToggle view="grid" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
  });
});

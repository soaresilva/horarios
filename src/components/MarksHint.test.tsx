import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarksHint } from "./MarksHint";

describe("MarksHint", () => {
  it("shows on a fresh visitor (dismissed=false)", () => {
    render(<MarksHint dismissed={false} onDismiss={() => {}} />);
    expect(screen.getByText(/tap a set to mark it/i)).toBeInTheDocument();
  });

  it("renders nothing once dismissed", () => {
    render(<MarksHint dismissed={true} onDismiss={() => {}} />);
    expect(screen.queryByText(/tap a set to mark it/i)).not.toBeInTheDocument();
  });

  it("calls onDismiss when its own close button is tapped", async () => {
    const onDismiss = vi.fn();
    render(<MarksHint dismissed={false} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss hint/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

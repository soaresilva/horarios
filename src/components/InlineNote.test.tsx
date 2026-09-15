import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InlineNote } from "./InlineNote";

describe("InlineNote", () => {
  it("renders the note text", () => {
    render(<InlineNote note="front left, get there early" lines={2} />);
    expect(screen.getByText("front left, get there early")).toBeInTheDocument();
  });

  it("carries the full note as title even when clamped", () => {
    const note = "a".repeat(200);
    render(<InlineNote note={note} lines={1} />);
    expect(screen.getByText(note)).toHaveAttribute("title", note);
  });

  it("uses truncate for a single line and line-clamp-2 for two", () => {
    const { rerender, container } = render(<InlineNote note="x" lines={1} />);
    expect(container.querySelector("span")).toHaveClass("truncate");
    expect(container.querySelector("span")).not.toHaveClass("line-clamp-2");

    rerender(<InlineNote note="x" lines={2} />);
    expect(container.querySelector("span")).toHaveClass("line-clamp-2");
    expect(container.querySelector("span")).not.toHaveClass("truncate");
  });
});

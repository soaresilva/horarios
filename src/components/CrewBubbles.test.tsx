import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CrewBubbles } from "./CrewBubbles";
import type { FriendMark } from "@/lib/crew";

const friends: FriendMark[] = [
  { id: "D", tag: "D", colorIndex: 0, crewIds: ["x"], tier: "must", note: "front left" },
  { id: "M", tag: "M", colorIndex: 1, crewIds: ["x"], tier: "must" },
  { id: "Zs", tag: "Zs", colorIndex: 2, crewIds: ["x"], tier: "interested" },
  { id: "J", tag: "J", colorIndex: 3, crewIds: ["x"], tier: "interested" },
];

describe("CrewBubbles", () => {
  it("renders nothing without friends", () => {
    const { container } = render(<CrewBubbles friends={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("fills a must-see bubble and outlines an interested one, in the friend's colour", () => {
    const { container } = render(<CrewBubbles friends={friends.slice(0, 3)} />);
    const d = container.querySelector('[data-crew-tag="D"]') as HTMLElement;
    const zs = container.querySelector('[data-crew-tag="Zs"]') as HTMLElement;
    expect(d.style.backgroundColor).toBe("rgb(251, 113, 133)");
    expect(d.dataset.crewTier).toBe("must");
    expect(zs.style.backgroundColor).toBe("");
    expect(zs.style.boxShadow).toBe("inset 0 0 0 1px #a78bfa");
    expect(zs.dataset.crewTier).toBe("interested");
  });

  it("collapses past `max` into +N, keeping the first (strongest) ones", () => {
    const { container } = render(<CrewBubbles friends={friends} max={2} />);
    expect([...container.querySelectorAll("[data-crew-tag]")].map((el) => el.textContent)).toEqual(["D", "M"]);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("lists every friend, hidden ones included, in the hover text and label", () => {
    render(<CrewBubbles friends={friends} max={1} />);
    const cluster = screen.getByRole("img");
    expect(cluster).toHaveAttribute("title", "D: must-see · front left\nM: must-see\nZs: interested\nJ: interested");
    expect(cluster).toHaveAccessibleName("Crew: D must-see, M must-see, Zs interested, J interested");
  });

  it("becomes one button when given onOpen, without the tap reaching the block underneath", async () => {
    const onOpen = vi.fn();
    const onBlock = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onBlock}>
        <CrewBubbles friends={friends} onOpen={onOpen} />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: /^Crew:/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onBlock).not.toHaveBeenCalled();
  });

  it("renders two different people with the same tag without a React key clash", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <CrewBubbles
        friends={[
          { id: "a", tag: "D", colorIndex: 0, crewIds: ["x"], tier: "must" },
          { id: "b", tag: "D", colorIndex: 1, crewIds: ["y"], tier: "must" },
        ]}
      />,
    );
    expect(container.querySelectorAll('[data-crew-tag="D"]')).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("wraps only when uncapped", () => {
    const { container, rerender } = render(<CrewBubbles friends={friends} />);
    expect(container.firstElementChild).toHaveClass("flex-wrap");
    rerender(<CrewBubbles friends={friends} max={2} />);
    expect(container.firstElementChild).not.toHaveClass("flex-wrap");
  });
});

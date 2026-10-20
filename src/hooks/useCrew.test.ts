import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCrew } from "./useCrew";
import type { CrewDTO } from "@/types/crew";

const actions = vi.hoisted(() => ({
  getCrew: vi.fn(),
  createCrew: vi.fn(),
  joinCrew: vi.fn(),
  leaveCrew: vi.fn(),
  updateMyCrewMember: vi.fn(),
}));

vi.mock("@/app/crew/actions", () => actions);

const crew: CrewDTO = {
  code: "KX7PQ2",
  me: { tag: "D", colorIndex: 0, shareNotes: true },
  members: [
    { tag: "M", colorIndex: 1, marks: { p1: { tier: "interested" } } },
    { tag: "Zs", colorIndex: 2, marks: { p1: { tier: "must", note: "front left" }, p2: { tier: "must" } } },
  ],
};

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useCrew", () => {
  it("makes no request at all for a visitor who isn't in a crew and never synced", async () => {
    const { result } = renderHook(() => useCrew("lotd26", true));
    await Promise.resolve();
    expect(actions.getCrew).not.toHaveBeenCalled();
    expect(result.current.crew).toBeNull();
    expect(result.current.friendsOf("p1")).toEqual([]);
  });

  it("joining stores the crew, marks this device a member, and exposes friends per set, strongest first", async () => {
    actions.joinCrew.mockResolvedValue({ crew });
    actions.getCrew.mockResolvedValue(crew);
    const { result } = renderHook(() => useCrew("lotd26", true));

    await act(async () => {
      await result.current.join("KX7-PQ2", "D");
    });

    expect(actions.joinCrew).toHaveBeenCalledWith("lotd26", "KX7-PQ2", "D");
    expect(window.localStorage.getItem("crew:member")).toBe("true");
    expect(result.current.crew?.code).toBe("KX7PQ2");
    expect(result.current.friendsOf("p1").map((f) => f.tag)).toEqual(["Zs", "M"]);
    expect(result.current.friendsOf("p1")[0].note).toBe("front left");
  });

  it("keeps the last snapshot when a refresh fails (no signal at the festival)", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("lotd26:crew", JSON.stringify({ crew, fetchedAt: "2026-10-23T20:00:00.000Z" }));
    actions.getCrew.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useCrew("lotd26", true));
    await waitFor(() => expect(actions.getCrew).toHaveBeenCalled());
    expect(result.current.crew?.code).toBe("KX7PQ2");
    expect(result.current.fetchedAt).toBe("2026-10-23T20:00:00.000Z");
    expect(window.localStorage.getItem("crew:member")).toBe("true");
  });

  it("forgets the crew when the server says this visitor left (e.g. from a paired phone)", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("lotd26:crew", JSON.stringify({ crew, fetchedAt: null }));
    actions.getCrew.mockResolvedValue(null);

    const { result } = renderHook(() => useCrew("lotd26", true));
    await waitFor(() => expect(result.current.crew).toBeNull());
    expect(window.localStorage.getItem("crew:member")).toBeNull();
  });

  it("checks once on mount for a synced device, so a crew joined on its paired phone shows up", async () => {
    window.localStorage.setItem("lotd26:synced", "true");
    actions.getCrew.mockResolvedValue(crew);
    const { result } = renderHook(() => useCrew("lotd26", true));
    await waitFor(() => expect(result.current.crew?.code).toBe("KX7PQ2"));
    expect(window.localStorage.getItem("crew:member")).toBe("true");
  });

  it("polls every minute while in a crew", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("crew:member", "true");
    actions.getCrew.mockResolvedValue(crew);
    renderHook(() => useCrew("lotd26", true));
    expect(actions.getCrew).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(actions.getCrew).toHaveBeenCalledTimes(2);
  });

  it("leaving clears the snapshot and membership", async () => {
    actions.createCrew.mockResolvedValue({ crew });
    actions.leaveCrew.mockResolvedValue({ ok: true });
    actions.getCrew.mockResolvedValue(crew);
    const { result } = renderHook(() => useCrew("lotd26", true));
    await act(async () => {
      await result.current.create("D");
    });
    expect(result.current.crew).not.toBeNull();

    await act(async () => {
      await result.current.leave();
    });
    expect(result.current.crew).toBeNull();
    expect(window.localStorage.getItem("crew:member")).toBeNull();
  });

  it("an error from the server leaves the stored crew untouched", async () => {
    actions.joinCrew.mockResolvedValue({ error: "tag-taken" });
    const { result } = renderHook(() => useCrew("lotd26", true));
    let outcome;
    await act(async () => {
      outcome = await result.current.join("KX7PQ2", "Zs");
    });
    expect(outcome).toEqual({ error: "tag-taken" });
    expect(result.current.crew).toBeNull();
    expect(window.localStorage.getItem("crew:member")).toBeNull();
  });

  it("is inert, with no requests and no friends, on a festival with crews off", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("pdc26:crew", JSON.stringify({ crew, fetchedAt: null }));
    const { result } = renderHook(() => useCrew("pdc26", false));
    await Promise.resolve();
    expect(actions.getCrew).not.toHaveBeenCalled();
    expect(result.current.crew).toBeNull();
    expect(result.current.friendsOf("p1")).toEqual([]);
  });
});

describe("useCrew polling", () => {
  it("keeps friendsOf stable across a poll that returns the same crew, so the grid doesn't re-render for nothing", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("crew:member", "true");
    actions.getCrew.mockImplementation(async () => structuredClone(crew));
    const { result } = renderHook(() => useCrew("lotd26", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const before = result.current.friendsOf;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(actions.getCrew).toHaveBeenCalledTimes(2);
    expect(result.current.friendsOf).toBe(before);

    actions.getCrew.mockImplementation(async () => ({ ...structuredClone(crew), members: [] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.friendsOf).not.toBe(before);
    expect(result.current.friendsOf("p1")).toEqual([]);
  });
});

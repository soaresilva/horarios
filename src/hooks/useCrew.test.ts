import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCrew } from "./useCrew";
import type { CrewsDTO } from "@/types/crew";

const actions = vi.hoisted(() => ({
  getCrews: vi.fn(),
  createCrew: vi.fn(),
  joinCrew: vi.fn(),
  leaveCrew: vi.fn(),
  renameCrew: vi.fn(),
  updateMyCrewMember: vi.fn(),
}));

vi.mock("@/app/crew/actions", () => actions);

const crews: CrewsDTO = {
  crews: [
    {
      id: "x",
      code: "KX7PQ2",
      name: "LGW gang",
      me: { tag: "D", colorIndex: 0, shareNotes: true },
      members: [
        { tag: "M", colorIndex: 1 },
        { tag: "Zs", colorIndex: 2 },
      ],
    },
    { id: "y", code: "BH53RW", name: null, me: { tag: "D", colorIndex: 0, shareNotes: true }, members: [{ tag: "F", colorIndex: 1 }] },
  ],
  friends: [
    { id: "m", tag: "M", colorIndex: 1, crewIds: ["x"], marks: { p1: { tier: "interested" } } },
    { id: "zs", tag: "Zs", colorIndex: 2, crewIds: ["x", "y"], marks: { p1: { tier: "must", note: "front left" }, p2: { tier: "must" } } },
    { id: "f", tag: "F", colorIndex: 1, crewIds: ["y"], marks: { p1: { tier: "must" } } },
  ],
};

const oneCrew: CrewsDTO = { crews: [crews.crews[1]], friends: [crews.friends[2]] };

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useCrew", () => {
  it("makes no request at all for a visitor who isn't in a crew and never synced", async () => {
    const { result } = renderHook(() => useCrew("lotd26", true));
    await Promise.resolve();
    expect(actions.getCrews).not.toHaveBeenCalled();
    expect(result.current.crews).toEqual([]);
    expect(result.current.friendsOf("p1")).toEqual([]);
  });

  it("joining stores the crew, marks this device a member, and exposes friends per set, strongest first", async () => {
    actions.joinCrew.mockResolvedValue({ crews });
    actions.getCrews.mockResolvedValue(crews);
    const { result } = renderHook(() => useCrew("lotd26", true));

    await act(async () => {
      await result.current.join("KX7-PQ2", "D");
    });

    expect(actions.joinCrew).toHaveBeenCalledWith("lotd26", "KX7-PQ2", "D");
    expect(window.localStorage.getItem("crew:member")).toBe("true");
    expect(result.current.crews.map((c) => c.code)).toEqual(["KX7PQ2", "BH53RW"]);
    expect(result.current.friendsOf("p1").map((f) => f.tag)).toEqual(["F", "Zs", "M"]);
    expect(result.current.friendsOf("p1")[1].note).toBe("front left");
  });

  it("keeps the last snapshot when a refresh fails (no signal at the festival)", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("lotd26:crews", JSON.stringify({ crews, fetchedAt: "2026-10-23T20:00:00.000Z" }));
    actions.getCrews.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useCrew("lotd26", true));
    await waitFor(() => expect(actions.getCrews).toHaveBeenCalled());
    expect(result.current.crews[0]?.code).toBe("KX7PQ2");
    expect(result.current.fetchedAt).toBe("2026-10-23T20:00:00.000Z");
    expect(window.localStorage.getItem("crew:member")).toBe("true");
  });

  it("forgets the crew when the server says this visitor left (e.g. from a paired phone)", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("lotd26:crews", JSON.stringify({ crews, fetchedAt: null }));
    actions.getCrews.mockResolvedValue(null);

    const { result } = renderHook(() => useCrew("lotd26", true));
    await waitFor(() => expect(result.current.crews).toEqual([]));
    expect(window.localStorage.getItem("crew:member")).toBeNull();
  });

  it("checks once on mount for a synced device, so a crew joined on its paired phone shows up", async () => {
    window.localStorage.setItem("lotd26:synced", "true");
    actions.getCrews.mockResolvedValue(crews);
    const { result } = renderHook(() => useCrew("lotd26", true));
    await waitFor(() => expect(result.current.crews[0]?.code).toBe("KX7PQ2"));
    expect(window.localStorage.getItem("crew:member")).toBe("true");
  });

  it("polls every minute while in a crew", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("crew:member", "true");
    actions.getCrews.mockResolvedValue(crews);
    renderHook(() => useCrew("lotd26", true));
    expect(actions.getCrews).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(actions.getCrews).toHaveBeenCalledTimes(2);
  });

  it("leaving your last crew clears the snapshot and membership", async () => {
    actions.createCrew.mockResolvedValue({ crews });
    actions.leaveCrew.mockResolvedValue(null);
    actions.getCrews.mockResolvedValue(crews);
    const { result } = renderHook(() => useCrew("lotd26", true));
    await act(async () => {
      await result.current.create("D", "");
    });
    expect(result.current.crews).toHaveLength(2);

    await act(async () => {
      await result.current.leave("x");
    });
    expect(result.current.crews).toEqual([]);
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
    expect(result.current.crews).toEqual([]);
    expect(window.localStorage.getItem("crew:member")).toBeNull();
  });

  it("is inert, with no requests and no friends, on a festival with crews off", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("pdc26:crews", JSON.stringify({ crews, fetchedAt: null }));
    const { result } = renderHook(() => useCrew("pdc26", false));
    await Promise.resolve();
    expect(actions.getCrews).not.toHaveBeenCalled();
    expect(result.current.crews).toEqual([]);
    expect(result.current.friendsOf("p1")).toEqual([]);
  });
});

describe("useCrew polling", () => {
  it("keeps friendsOf stable across a poll that returns the same crew, so the grid doesn't re-render for nothing", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem("crew:member", "true");
    actions.getCrews.mockImplementation(async () => structuredClone(crews));
    const { result } = renderHook(() => useCrew("lotd26", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const before = result.current.friendsOf;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(actions.getCrews).toHaveBeenCalledTimes(2);
    expect(result.current.friendsOf).toBe(before);

    actions.getCrews.mockImplementation(async () => ({ ...structuredClone(crews), friends: [] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(result.current.friendsOf).not.toBe(before);
    expect(result.current.friendsOf("p1")).toEqual([]);
  });
});

describe("useCrew with several crews", () => {
  async function inTwoCrews() {
    actions.createCrew.mockResolvedValue({ crews });
    actions.getCrews.mockResolvedValue(crews);
    const hook = renderHook(() => useCrew("lgw26", true));
    await act(async () => {
      await hook.result.current.create("D", "");
    });
    return hook;
  }

  it("leaving one of two crews keeps the other, and membership", async () => {
    actions.leaveCrew.mockResolvedValue(oneCrew);
    const { result } = await inTwoCrews();
    await act(async () => {
      await result.current.leave("x");
    });
    expect(actions.leaveCrew).toHaveBeenCalledWith("lgw26", "x");
    expect(result.current.crews.map((c) => c.id)).toEqual(["y"]);
    expect(window.localStorage.getItem("crew:member")).toBe("true");
  });

  it("hiding a crew hides its people but not anyone also in a crew still showing, and survives a remount", async () => {
    const { result, unmount } = await inTwoCrews();
    act(() => {
      result.current.toggleCrewHidden("y");
    });
    expect(result.current.friendsOf("p1").map((f) => f.tag)).toEqual(["Zs", "M"]);
    expect(result.current.friends).toHaveLength(3);
    expect(JSON.parse(window.localStorage.getItem("crew:hiddenCrews")!)).toEqual(["y"]);

    unmount();
    const again = renderHook(() => useCrew("lgw26", true));
    expect(again.result.current.hiddenCrewIds.has("y")).toBe(true);
    await waitFor(() => expect(actions.getCrews).toHaveBeenCalled());
    act(() => {
      again.result.current.toggleCrewHidden("y");
    });
    expect(again.result.current.friendsOf("p1").map((f) => f.tag)).toEqual(["F", "Zs", "M"]);
    expect(window.localStorage.getItem("crew:hiddenCrews")).toBeNull();
  });

  it("forgets a crew's hidden state when you leave it", async () => {
    actions.leaveCrew.mockResolvedValue(oneCrew);
    const { result } = await inTwoCrews();
    act(() => {
      result.current.toggleCrewHidden("x");
    });
    await act(async () => {
      await result.current.leave("x");
    });
    expect(result.current.hiddenCrewIds.size).toBe(0);
  });

  it("names the crews a friend is in, but only when you're in more than one", async () => {
    const { result } = await inTwoCrews();
    const zs = result.current.friendsOf("p2")[0];
    expect(result.current.crewLabelOf(zs)).toBe("LGW gang, BH5-3RW");

    actions.leaveCrew.mockResolvedValue(oneCrew);
    await act(async () => {
      await result.current.leave("x");
    });
    expect(result.current.crewLabelOf(zs)).toBeNull();
  });

  it("re-reads rather than wiping everything when one seat turns out to be gone", async () => {
    actions.renameCrew.mockResolvedValue({ error: "not-in-crew" });
    const { result } = await inTwoCrews();
    actions.getCrews.mockClear();
    actions.getCrews.mockResolvedValue(oneCrew);
    await act(async () => {
      await result.current.rename("x", "New");
    });
    await waitFor(() => expect(result.current.crews.map((c) => c.id)).toEqual(["y"]));
    expect(window.localStorage.getItem("crew:member")).toBe("true");
  });

  it("ignores and clears the old one-crew snapshot", async () => {
    window.localStorage.setItem("crew:member", "true");
    window.localStorage.setItem("lotd26:crew", JSON.stringify({ crew: { code: "OLD" }, fetchedAt: null }));
    actions.getCrews.mockResolvedValue(oneCrew);
    const { result } = renderHook(() => useCrew("lotd26", true));
    expect(result.current.crews).toEqual([]);
    await waitFor(() => expect(result.current.crews.map((c) => c.id)).toEqual(["y"]));
    expect(window.localStorage.getItem("lotd26:crew")).toBeNull();
  });
});

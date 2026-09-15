import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFavoritesSync } from "./useFavoritesSync";
import { EMPTY_MARKS_PAYLOAD } from "@/lib/marks";

const actions = vi.hoisted(() => ({
  optIntoSync: vi.fn(),
  listMarks: vi.fn(),
  syncMarks: vi.fn(),
  generatePairingCode: vi.fn(),
  redeemPairingCode: vi.fn(),
}));

vi.mock("@/app/favorites/actions", () => actions);

afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("useFavoritesSync — not opted in", () => {
  it("behaves exactly like plain marking, with zero network calls", async () => {
    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    expect(result.current.synced).toBe(false);
    expect(result.current.tierOf("p1")).toBeNull();

    act(() => {
      result.current.cycle("p1");
    });

    expect(result.current.tierOf("p1")).toBe("must");
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBeNull();

    // Flush any pending microtasks the mount effect might have scheduled.
    await Promise.resolve();

    expect(actions.optIntoSync).not.toHaveBeenCalled();
    expect(actions.listMarks).not.toHaveBeenCalled();
    expect(actions.syncMarks).not.toHaveBeenCalled();
  });
});

describe("useFavoritesSync — opted in", () => {
  it("cycling updates localStorage immediately (offline-safe) and pushes the full payload shape only after the debounce", async () => {
    actions.optIntoSync.mockResolvedValue({ visitorId: "v1" });
    actions.syncMarks.mockResolvedValue({ server: EMPTY_MARKS_PAYLOAD });
    vi.useFakeTimers();

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    await act(async () => {
      await result.current.startSync();
    });
    expect(result.current.synced).toBe(true);

    act(() => {
      result.current.cycle("p1");
    });

    // Optimistic local write happens synchronously, before any network call —
    // this is what keeps marking instant on bad festival-grounds signal.
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBe("true");
    expect(actions.syncMarks).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(actions.syncMarks).toHaveBeenCalledWith("pdc26", { mustSee: ["p1"], interested: [], notes: {} });
    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBeNull();
  });

  it("a note-only edit also marks the device dirty and pushes the full payload", async () => {
    actions.optIntoSync.mockResolvedValue({ visitorId: "v1" });
    actions.syncMarks.mockResolvedValue({ server: EMPTY_MARKS_PAYLOAD });
    vi.useFakeTimers();

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    await act(async () => {
      await result.current.startSync();
    });

    act(() => {
      result.current.setNote("p1", "front left, get there early");
    });

    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBe("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(actions.syncMarks).toHaveBeenCalledWith("pdc26", {
      mustSee: [],
      interested: [],
      notes: { p1: "front left, get there early" },
    });
  });

  it("on mount, a dirty device pushes its own payload instead of pulling and clobbering it", async () => {
    window.localStorage.setItem("pdc26:synced", "true");
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["p1"]));
    window.localStorage.setItem("pdc26:starred:dirty", "true");
    actions.syncMarks.mockResolvedValue({ server: { mustSee: ["p1"], interested: [], notes: {} } });

    renderHook(() => useFavoritesSync("pdc26"));

    await waitFor(() => {
      expect(actions.syncMarks).toHaveBeenCalledWith("pdc26", { mustSee: ["p1"], interested: [], notes: {} });
    });
    expect(actions.listMarks).not.toHaveBeenCalled();
  });

  it("an `online` event pulls and adopts the server payload when this device has no pending edits", async () => {
    window.localStorage.setItem("pdc26:synced", "true");
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["p1"]));
    actions.listMarks.mockResolvedValue({ mustSee: ["p1"], interested: [], notes: {} });

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    await waitFor(() => {
      expect(actions.listMarks).toHaveBeenCalledWith("pdc26");
    });
    actions.listMarks.mockClear();
    actions.listMarks.mockResolvedValue({ mustSee: ["p1"], interested: ["p3"], notes: { p1: "note" } });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.tierOf("p3")).toBe("interested");
    });
    expect(result.current.tierOf("p1")).toBe("must");
    expect(result.current.noteOf("p1")).toBe("note");
  });
});

describe("useFavoritesSync — pairing code redemption", () => {
  it("overwrites localStorage with the merged tiers/notes and marks the device synced", async () => {
    actions.redeemPairingCode.mockResolvedValue({ mustSee: ["p1"], interested: ["p2"], notes: { p3: "a note" } });

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.redeemCode("123456");
    });

    expect(outcome).toEqual({ ok: true });
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
    expect(JSON.parse(window.localStorage.getItem("pdc26:interested") ?? "[]")).toEqual(["p2"]);
    expect(JSON.parse(window.localStorage.getItem("pdc26:notes") ?? "{}")).toEqual({ p3: "a note" });
    expect(result.current.synced).toBe(true);
  });

  it("surfaces an invalid/expired error without touching localStorage", async () => {
    actions.redeemPairingCode.mockResolvedValue({ error: "expired" });

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.redeemCode("000000");
    });

    expect(outcome).toEqual({ error: "expired" });
    expect(window.localStorage.getItem("pdc26:starred")).toBeNull();
    expect(result.current.synced).toBe(false);
  });
});

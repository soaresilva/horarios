import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFavoritesSync } from "./useFavoritesSync";

const actions = vi.hoisted(() => ({
  optIntoSync: vi.fn(),
  listFavorites: vi.fn(),
  syncFavorites: vi.fn(),
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
  it("behaves exactly like plain starring, with zero network calls", async () => {
    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    expect(result.current.synced).toBe(false);
    expect(result.current.isStarred("p1")).toBe(false);

    act(() => {
      result.current.toggle("p1");
    });

    expect(result.current.isStarred("p1")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBeNull();

    // Flush any pending microtasks the mount effect might have scheduled.
    await Promise.resolve();

    expect(actions.optIntoSync).not.toHaveBeenCalled();
    expect(actions.listFavorites).not.toHaveBeenCalled();
    expect(actions.syncFavorites).not.toHaveBeenCalled();
  });
});

describe("useFavoritesSync — opted in", () => {
  it("toggling updates localStorage immediately (offline-safe) and pushes only after the debounce", async () => {
    actions.optIntoSync.mockResolvedValue({ visitorId: "v1" });
    actions.syncFavorites.mockResolvedValue({ serverIds: [] });
    vi.useFakeTimers();

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    await act(async () => {
      await result.current.startSync();
    });
    expect(result.current.synced).toBe(true);

    act(() => {
      result.current.toggle("p1");
    });

    // Optimistic local write happens synchronously, before any network call —
    // this is what keeps starring instant on bad festival-grounds signal.
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBe("true");
    expect(actions.syncFavorites).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(actions.syncFavorites).toHaveBeenCalledWith("pdc26", ["p1"]);
    expect(window.localStorage.getItem("pdc26:starred:dirty")).toBeNull();
  });

  it("on mount, a dirty device pushes its own array instead of pulling and clobbering it", async () => {
    window.localStorage.setItem("pdc26:synced", "true");
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["p1"]));
    window.localStorage.setItem("pdc26:starred:dirty", "true");
    actions.syncFavorites.mockResolvedValue({ serverIds: ["p1"] });

    renderHook(() => useFavoritesSync("pdc26"));

    await waitFor(() => {
      expect(actions.syncFavorites).toHaveBeenCalledWith("pdc26", ["p1"]);
    });
    expect(actions.listFavorites).not.toHaveBeenCalled();
  });

  it("an `online` event pulls and adopts the server list when this device has no pending edits", async () => {
    window.localStorage.setItem("pdc26:synced", "true");
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["p1"]));
    actions.listFavorites.mockResolvedValue(["p1", "p2"]);

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    await waitFor(() => {
      expect(actions.listFavorites).toHaveBeenCalledWith("pdc26");
    });
    actions.listFavorites.mockClear();
    actions.listFavorites.mockResolvedValue(["p1", "p2", "p3"]);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isStarred("p3")).toBe(true);
    });
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1", "p2", "p3"]);
  });
});

describe("useFavoritesSync — pairing code redemption", () => {
  it("overwrites localStorage with the merged server ids and marks the device synced", async () => {
    actions.redeemPairingCode.mockResolvedValue({ favoriteIds: ["p1", "p2", "p3"] });

    const { result } = renderHook(() => useFavoritesSync("pdc26"));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.redeemCode("123456");
    });

    expect(outcome).toEqual({ ok: true });
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1", "p2", "p3"]);
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

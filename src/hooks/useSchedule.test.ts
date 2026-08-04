import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSchedule } from "./useSchedule";

const scheduleResponse = {
  updatedAt: "2026-08-04T00:00:00.000Z",
  stages: [],
  performances: [],
};

function mockFetchOk() {
  return vi.fn(async () => new Response(JSON.stringify(scheduleResponse), { status: 200 }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetchOk());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useSchedule", () => {
  it("fetches once on mount", async () => {
    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.schedule).not.toBeNull();
  });

  it("re-fetches when the tab regains visibility", async () => {
    // Regression: a PWA opened from the home screen is typically suspended
    // rather than fully reloaded when backgrounded, so a mount-only fetch
    // could go hours without seeing an edit saved via /admin. Simulates the
    // resume-from-background case via the visibilitychange event the app
    // now listens for.
    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("does not re-fetch on a visibilitychange event while the tab is hidden", async () => {
    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    // No new fetch should be in flight; give any errant async call a tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("re-fetches on window focus", async () => {
    const { result } = renderHook(() => useSchedule());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("polls on an interval while the tab stays visible", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    const { result } = renderHook(() => useSchedule());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("stops polling and removes listeners after unmount", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    const { result, unmount } = renderHook(() => useSchedule());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    unmount();

    await vi.advanceTimersByTimeAsync(120_000);
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

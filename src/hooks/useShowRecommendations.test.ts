import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShowRecommendations } from "./useShowRecommendations";

const KEY = "pdc26:showRecommendations";

afterEach(() => {
  window.localStorage.clear();
});

describe("useShowRecommendations", () => {
  it("defaults to shown when nothing is stored", () => {
    const { result } = renderHook(() => useShowRecommendations());
    expect(result.current.show).toBe(true);
  });

  it("toggles off and persists 'false'", () => {
    const { result } = renderHook(() => useShowRecommendations());
    act(() => result.current.toggle());
    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  it("toggles back on and persists 'true'", () => {
    const { result } = renderHook(() => useShowRecommendations());
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.show).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("rehydrates a stored 'false' on mount", () => {
    window.localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useShowRecommendations());
    expect(result.current.show).toBe(false);
  });
});

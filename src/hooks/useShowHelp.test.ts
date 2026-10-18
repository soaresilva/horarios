import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShowHelp } from "./useShowHelp";

const KEY = "app:showHelp";

afterEach(() => {
  window.localStorage.clear();
});

describe("useShowHelp", () => {
  it("defaults to true (help shown) when nothing is stored", () => {
    const { result } = renderHook(() => useShowHelp());
    expect(result.current.show).toBe(true);
  });

  it("toggles off and persists 'false' under the shared key", () => {
    const { result } = renderHook(() => useShowHelp());
    act(() => result.current.toggle());
    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  it("rehydrates a stored 'false' on mount", () => {
    window.localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useShowHelp());
    expect(result.current.show).toBe(false);
  });

  it("is shared: toggling in one timetable updates every mounted instance", () => {
    const { result: a } = renderHook(() => useShowHelp());
    const { result: b } = renderHook(() => useShowHelp());

    act(() => a.current.toggle());

    expect(a.current.show).toBe(false);
    expect(b.current.show).toBe(false);
  });

  it("falls back to true when localStorage throws", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const { result } = renderHook(() => useShowHelp());
      expect(result.current.show).toBe(true);
    } finally {
      window.localStorage.getItem = original;
    }
  });
});

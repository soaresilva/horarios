import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShowHelp } from "./useShowHelp";

const KEY = "lotd26:showHelp";

afterEach(() => {
  window.localStorage.clear();
});

describe("useShowHelp", () => {
  it("defaults to true (help shown) when nothing is stored", () => {
    const { result } = renderHook(() => useShowHelp("lotd26"));
    expect(result.current.show).toBe(true);
  });

  it("toggles off and persists 'false' under the festival's key", () => {
    const { result } = renderHook(() => useShowHelp("lotd26"));
    act(() => result.current.toggle());
    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  it("rehydrates a stored 'false' on mount", () => {
    window.localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useShowHelp("lotd26"));
    expect(result.current.show).toBe(false);
  });

  it("is scoped per festival slug, so each timetable keeps its own choice", () => {
    const { result: lotd } = renderHook(() => useShowHelp("lotd26"));
    const { result: lgw } = renderHook(() => useShowHelp("lgw26"));

    act(() => lotd.current.toggle());

    expect(lotd.current.show).toBe(false);
    expect(lgw.current.show).toBe(true);
    expect(window.localStorage.getItem("lgw26:showHelp")).toBeNull();
  });

  it("falls back to true when localStorage throws", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const { result } = renderHook(() => useShowHelp("lotd26"));
      expect(result.current.show).toBe(true);
    } finally {
      window.localStorage.getItem = original;
    }
  });
});

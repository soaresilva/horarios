import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShowNotes } from "./useShowNotes";

const KEY = "pdc26:showNotes";

afterEach(() => {
  window.localStorage.clear();
});

describe("useShowNotes", () => {
  it("defaults to false when nothing is stored", () => {
    const { result } = renderHook(() => useShowNotes("pdc26"));
    expect(result.current.show).toBe(false);
  });

  it("toggles on and persists 'true' under the given festival's key", () => {
    const { result } = renderHook(() => useShowNotes("pdc26"));
    act(() => result.current.toggle());
    expect(result.current.show).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("toggles back off and persists 'false'", () => {
    const { result } = renderHook(() => useShowNotes("pdc26"));
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  it("rehydrates a stored 'true' on mount", () => {
    window.localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useShowNotes("pdc26"));
    expect(result.current.show).toBe(true);
  });

  it("is scoped per festival slug — toggling one festival doesn't affect another's", () => {
    const { result: pdc } = renderHook(() => useShowNotes("pdc26"));
    const { result: lotd } = renderHook(() => useShowNotes("lotd26"));

    act(() => pdc.current.toggle());

    expect(pdc.current.show).toBe(true);
    expect(lotd.current.show).toBe(false);
    expect(window.localStorage.getItem("lotd26:showNotes")).toBeNull();
  });

  it("falls back to false when localStorage throws", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const { result } = renderHook(() => useShowNotes("pdc26"));
      expect(result.current.show).toBe(false);
    } finally {
      window.localStorage.getItem = original;
    }
  });
});

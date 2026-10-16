import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShowSideProgramme } from "./useShowSideProgramme";

const KEY = "lotd26:showSideProgramme";

afterEach(() => {
  window.localStorage.clear();
});

describe("useShowSideProgramme", () => {
  it("defaults to shown when nothing is stored", () => {
    const { result } = renderHook(() => useShowSideProgramme("lotd26"));
    expect(result.current.show).toBe(true);
  });

  it("hides and persists 'false', then shows again and persists 'true'", () => {
    const { result } = renderHook(() => useShowSideProgramme("lotd26"));
    act(() => result.current.toggle());
    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
    act(() => result.current.toggle());
    expect(result.current.show).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("rehydrates a stored 'false' on mount", () => {
    window.localStorage.setItem(KEY, "false");
    const { result } = renderHook(() => useShowSideProgramme("lotd26"));
    expect(result.current.show).toBe(false);
  });

  it("treats any value other than 'false' as shown", () => {
    window.localStorage.setItem(KEY, "garbage");
    const { result } = renderHook(() => useShowSideProgramme("lotd26"));
    expect(result.current.show).toBe(true);
  });

  it("is scoped per festival slug", () => {
    const { result: lotd } = renderHook(() => useShowSideProgramme("lotd26"));
    const { result: pdc } = renderHook(() => useShowSideProgramme("pdc26"));
    act(() => lotd.current.toggle());
    expect(lotd.current.show).toBe(false);
    expect(pdc.current.show).toBe(true);
  });

  it("falls back to shown when localStorage throws", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const { result } = renderHook(() => useShowSideProgramme("lotd26"));
      expect(result.current.show).toBe(true);
    } finally {
      window.localStorage.getItem = original;
    }
  });
});

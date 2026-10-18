import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShowNonConcerts, useShowSideProgramme } from "./useShowSideProgramme";

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

describe("useShowSideProgramme with a default of hidden (U?)", () => {
  const LGW_KEY = "lgw26:showSideProgramme";

  it("starts hidden when nothing is stored", () => {
    const { result } = renderHook(() => useShowSideProgramme("lgw26", false));
    expect(result.current.show).toBe(false);
  });

  it("shows and persists 'true', hides and persists 'false'", () => {
    const { result } = renderHook(() => useShowSideProgramme("lgw26", false));
    act(() => result.current.toggle());
    expect(result.current.show).toBe(true);
    expect(window.localStorage.getItem(LGW_KEY)).toBe("true");
    act(() => result.current.toggle());
    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(LGW_KEY)).toBe("false");
  });

  it("treats garbage as the default, hidden", () => {
    window.localStorage.setItem(LGW_KEY, "garbage");
    const { result } = renderHook(() => useShowSideProgramme("lgw26", false));
    expect(result.current.show).toBe(false);
  });

  it("falls back to hidden when localStorage throws", () => {
    const original = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const { result } = renderHook(() => useShowSideProgramme("lgw26", false));
      expect(result.current.show).toBe(false);
    } finally {
      window.localStorage.getItem = original;
    }
  });
});

describe("useShowNonConcerts", () => {
  it("has its own key, independent of the side-programme switch", () => {
    const { result: nonConcerts } = renderHook(() => useShowNonConcerts("lgw26", false));
    const { result: side } = renderHook(() => useShowSideProgramme("lgw26", false));
    act(() => nonConcerts.current.toggle());
    expect(nonConcerts.current.show).toBe(true);
    expect(side.current.show).toBe(false);
    expect(window.localStorage.getItem("lgw26:showNonConcerts")).toBe("true");
    expect(window.localStorage.getItem("lgw26:showSideProgramme")).toBeNull();
  });
});

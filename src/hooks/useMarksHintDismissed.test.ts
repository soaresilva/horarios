import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMarksHintDismissed } from "./useMarksHintDismissed";

const KEY = "pdc26:marksHintDismissed";

afterEach(() => {
  window.localStorage.clear();
});

describe("useMarksHintDismissed", () => {
  it("defaults to not dismissed when nothing is stored", () => {
    const { result } = renderHook(() => useMarksHintDismissed("pdc26"));
    expect(result.current.dismissed).toBe(false);
  });

  it("dismiss() flips to true and persists 'true' under the given festival's key", () => {
    const { result } = renderHook(() => useMarksHintDismissed("pdc26"));
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("rehydrates a stored dismissal on mount", () => {
    window.localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useMarksHintDismissed("pdc26"));
    expect(result.current.dismissed).toBe(true);
  });

  it("is scoped per festival slug — dismissing one festival's hint doesn't dismiss another's", () => {
    const { result: pdc } = renderHook(() => useMarksHintDismissed("pdc26"));
    const { result: lotd } = renderHook(() => useMarksHintDismissed("lotd26"));

    act(() => pdc.current.dismiss());

    expect(pdc.current.dismissed).toBe(true);
    expect(lotd.current.dismissed).toBe(false);
    expect(window.localStorage.getItem("lotd26:marksHintDismissed")).toBeNull();
  });
});

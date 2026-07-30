import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInstallBannerDismissed } from "./useInstallBannerDismissed";

const KEY = "pdc26:installBannerDismissed";

afterEach(() => {
  window.localStorage.clear();
});

describe("useInstallBannerDismissed", () => {
  it("defaults to not dismissed when nothing is stored", () => {
    const { result } = renderHook(() => useInstallBannerDismissed());
    expect(result.current.dismissed).toBe(false);
  });

  it("dismiss() flips to true and persists 'true'", () => {
    const { result } = renderHook(() => useInstallBannerDismissed());
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");
  });

  it("rehydrates a stored dismissal on mount", () => {
    window.localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useInstallBannerDismissed());
    expect(result.current.dismissed).toBe(true);
  });
});

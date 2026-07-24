import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStarred } from "./useStarred";

afterEach(() => {
  window.localStorage.clear();
});

describe("useStarred", () => {
  it("starts with nothing starred and persists a toggle to localStorage", async () => {
    const { result } = renderHook(() => useStarred());
    expect(result.current.isStarred("p1")).toBe(false);

    act(() => {
      result.current.toggle("p1");
    });

    expect(result.current.isStarred("p1")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
  });

  it("toggling twice unstars it again and removes it from storage", () => {
    const { result } = renderHook(() => useStarred());

    act(() => result.current.toggle("p1"));
    act(() => result.current.toggle("p1"));

    expect(result.current.isStarred("p1")).toBe(false);
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual([]);
  });

  it("rehydrates previously-starred ids from localStorage on mount", async () => {
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["p1", "p2"]));

    const { result } = renderHook(() => useStarred());

    await waitFor(() => {
      expect(result.current.isStarred("p1")).toBe(true);
    });
    expect(result.current.isStarred("p2")).toBe(true);
    expect(result.current.isStarred("p3")).toBe(false);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getServerSnapshot, useMarks } from "./useMarks";

afterEach(() => {
  window.localStorage.clear();
});

describe("useMarks — must-see cases (migrated from useStarred)", () => {
  it("starts with nothing marked and persists a cycle to localStorage as must-see", async () => {
    const { result } = renderHook(() => useMarks("pdc26"));
    expect(result.current.tierOf("p1")).toBeNull();

    act(() => {
      result.current.cycle("p1");
    });

    expect(result.current.tierOf("p1")).toBe("must");
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
  });

  it("cycling three times returns to unmarked and removes it from storage", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    act(() => result.current.cycle("p1"));
    act(() => result.current.cycle("p1"));
    act(() => result.current.cycle("p1"));

    expect(result.current.tierOf("p1")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("pdc26:interested") ?? "[]")).toEqual([]);
  });

  it("rehydrates previously-marked ids from localStorage on mount", async () => {
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["p1", "p2"]));

    const { result } = renderHook(() => useMarks("pdc26"));

    await waitFor(() => {
      expect(result.current.tierOf("p1")).toBe("must");
    });
    expect(result.current.tierOf("p2")).toBe("must");
    expect(result.current.tierOf("p3")).toBeNull();
  });

  it("getServerSnapshot returns a referentially stable value", () => {
    // useSyncExternalStore requires this — a fresh object on every call
    // triggers React's "getServerSnapshot should be cached" warning/loop.
    expect(getServerSnapshot()).toBe(getServerSnapshot());
  });
});

describe("useMarks — compat regression (THE hard constraint)", () => {
  // A pre-existing visitor's `${slug}:starred` array (written by the old
  // single-tier useStarred) must read back as must-see with zero migration
  // code — no key rename, no one-time conversion pass. This is the
  // regression test the plan calls out explicitly: losing this would lose
  // every existing visitor's selections.
  it("a pre-existing pdc26:starred array reads back as must-see with no migration", async () => {
    window.localStorage.setItem("pdc26:starred", JSON.stringify(["old-favorite-1", "old-favorite-2"]));

    const { result } = renderHook(() => useMarks("pdc26"));

    await waitFor(() => {
      expect(result.current.tierOf("old-favorite-1")).toBe("must");
    });
    expect(result.current.tierOf("old-favorite-2")).toBe("must");
    // The key itself is untouched — same name, same shape.
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred")!)).toEqual(["old-favorite-1", "old-favorite-2"]);
  });
});

describe("useMarks — cycle order and tier exclusivity", () => {
  it("cycles null → must → interested → null", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    expect(result.current.tierOf("p1")).toBeNull();
    act(() => result.current.cycle("p1"));
    expect(result.current.tierOf("p1")).toBe("must");
    act(() => result.current.cycle("p1"));
    expect(result.current.tierOf("p1")).toBe("interested");
    act(() => result.current.cycle("p1"));
    expect(result.current.tierOf("p1")).toBeNull();
  });

  it("an id never appears in both tiers at once", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    act(() => result.current.setTier("p1", "must"));
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual(["p1"]);
    expect(JSON.parse(window.localStorage.getItem("pdc26:interested") ?? "[]")).toEqual([]);

    act(() => result.current.setTier("p1", "interested"));
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("pdc26:interested") ?? "[]")).toEqual(["p1"]);

    act(() => result.current.setTier("p1", null));
    expect(JSON.parse(window.localStorage.getItem("pdc26:starred") ?? "[]")).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("pdc26:interested") ?? "[]")).toEqual([]);
  });
});

describe("useMarks — notes", () => {
  it("sets and clears a note independently of tier", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    expect(result.current.noteOf("p1")).toBe("");

    act(() => result.current.setNote("p1", "front left, get there early"));
    expect(result.current.noteOf("p1")).toBe("front left, get there early");
    expect(JSON.parse(window.localStorage.getItem("pdc26:notes") ?? "{}")).toEqual({
      p1: "front left, get there early",
    });

    act(() => result.current.setNote("p1", ""));
    expect(result.current.noteOf("p1")).toBe("");
    expect(window.localStorage.getItem("pdc26:notes")).toBeNull();
  });

  it("a note can exist on an unmarked set", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    act(() => result.current.setNote("p1", "skip if queue is bad"));
    expect(result.current.tierOf("p1")).toBeNull();
    expect(result.current.noteOf("p1")).toBe("skip if queue is bad");
  });

  it("a note survives a tier change", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    act(() => result.current.setNote("p1", "keep this"));
    act(() => result.current.cycle("p1"));
    act(() => result.current.cycle("p1"));

    expect(result.current.tierOf("p1")).toBe("interested");
    expect(result.current.noteOf("p1")).toBe("keep this");
  });

  it("a note survives clearing the tier back to unmarked", () => {
    const { result } = renderHook(() => useMarks("pdc26"));

    act(() => result.current.setTier("p1", "must"));
    act(() => result.current.setNote("p1", "keep this"));
    act(() => result.current.setTier("p1", null));

    expect(result.current.tierOf("p1")).toBeNull();
    expect(result.current.noteOf("p1")).toBe("keep this");
  });
});

describe("useMarks — corrupt storage", () => {
  it("falls back to empty state when the stored JSON is corrupt", () => {
    window.localStorage.setItem("pdc26:starred", "{not valid json");
    window.localStorage.setItem("pdc26:interested", "[[[");
    window.localStorage.setItem("pdc26:notes", "not an object at all");

    const { result } = renderHook(() => useMarks("pdc26"));

    expect(result.current.tierOf("p1")).toBeNull();
    expect(result.current.noteOf("p1")).toBe("");
  });
});

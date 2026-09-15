import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLongPress } from "./useLongPress";

function pointerEvent(overrides: Partial<React.PointerEvent> = {}): React.PointerEvent {
  return { button: 0, clientX: 0, clientY: 0, ...overrides } as React.PointerEvent;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useLongPress", () => {
  it("fires at the 500ms threshold when the pointer stays still", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() => result.current.onPointerDown(pointerEvent()));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(499));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("is cancelled by a move past the 10px slop radius", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() => result.current.onPointerDown(pointerEvent({ clientX: 0, clientY: 0 })));
    act(() => result.current.onPointerMove(pointerEvent({ clientX: 15, clientY: 0 })));
    act(() => vi.advanceTimersByTime(500));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("tolerates a move within the 10px slop radius", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() => result.current.onPointerDown(pointerEvent({ clientX: 0, clientY: 0 })));
    act(() => result.current.onPointerMove(pointerEvent({ clientX: 3, clientY: 3 })));
    act(() => vi.advanceTimersByTime(500));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("is cancelled by an early pointerup", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() => result.current.onPointerDown(pointerEvent()));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onPointerUp(pointerEvent()));
    act(() => vi.advanceTimersByTime(500));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("fires immediately on contextmenu, without waiting for the timer", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));
    const preventDefault = vi.fn();

    act(() => result.current.onContextMenu({ preventDefault } as unknown as React.MouseEvent));

    expect(preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("suppresses exactly the one click that follows a fired long press", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() => result.current.onPointerDown(pointerEvent()));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    // The click that follows the release is suppressed once...
    expect(result.current.consumeSuppressedClick()).toBe(true);
    // ...and only once — the next tap behaves normally.
    expect(result.current.consumeSuppressedClick()).toBe(false);
  });

  it("does not suppress a click for a plain tap that never reached the threshold", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() => result.current.onPointerDown(pointerEvent()));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onPointerUp(pointerEvent()));

    expect(result.current.consumeSuppressedClick()).toBe(false);
  });
});

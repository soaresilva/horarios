"use client";

import { useCallback, useRef } from "react";

// A 500ms hold opens MarkSheet; anything shorter is a tap (handled by the
// block's own onClick) and anything that moves more than this many pixels
// before firing is a scroll, not a hold.
const LONG_PRESS_MS = 500;
const MOVE_SLOP_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  /**
   * Call at the top of the block's own onClick (the tap-to-cycle handler).
   * Returns true exactly once per long-press fire, meaning "this click is
   * the tail end of the hold that already opened the sheet — do nothing
   * else with it." A plain tap never sets the flag, so this is a no-op on
   * the common path.
   */
  consumeSuppressedClick: () => boolean;
}

// Returns pointer handlers a block spreads onto its root element. Fires
// `onLongPress` once, 500ms into a hold that hasn't moved past the slop
// radius. Also wires `onContextMenu` (desktop right-click / trackpad
// long-press equivalent) straight to the same callback.
//
// The load-bearing case is `onPointerMove`: this grid is scrolled by
// touch-dragging directly on the blocks (there's no separate drag handle),
// so a hold that turns into a scroll must cancel the timer rather than open
// the sheet mid-drag. 10px is generous enough that a genuinely-still finger
// (which drifts a pixel or two on real hardware) never mis-fires, while
// still catching an actual scroll well before it's gone anywhere.
//
// After the timer fires, the `click` event that the browser still sends on
// pointerup must NOT also run the tap handler (which would cycle the tier
// right after the sheet already opened it once) — `suppressNextClick`
// swallows exactly that one click.
export function useLongPress(onLongPress: (e: React.PointerEvent | React.MouseEvent) => void): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only the primary button/touch/pen contact arms the timer — a
      // secondary click is handled by onContextMenu instead.
      if (e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY };
      const event = e;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        suppressNextClickRef.current = true;
        onLongPress(event);
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = startRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > MOVE_SLOP_PX) clearTimer();
    },
    [clearTimer],
  );

  const onPointerUp = useCallback(() => clearTimer(), [clearTimer]);
  const onPointerCancel = useCallback(() => clearTimer(), [clearTimer]);
  const onPointerLeave = useCallback(() => clearTimer(), [clearTimer]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      suppressNextClickRef.current = true;
      onLongPress(e);
    },
    [onLongPress],
  );

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressNextClickRef.current) return false;
    suppressNextClickRef.current = false;
    return true;
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onContextMenu,
    consumeSuppressedClick,
  };
}

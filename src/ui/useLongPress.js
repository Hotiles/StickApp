import { useRef } from 'react';

/*
 * Långtryck (~500 ms) med rörelsetolerans. Returnerar props att sprida på
 * elementet. onTap körs vid kort tryck, onLongPress vid långt.
 */
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 14;

export function useLongPress({ onTap, onLongPress }) {
  const stateRef = useRef(null);

  function clear() {
    if (stateRef.current?.timer) clearTimeout(stateRef.current.timer);
    stateRef.current = null;
  }

  return {
    onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* pekaren kan redan vara borta */
      }
      const target = e.currentTarget;
      stateRef.current = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        fired: false,
        timer: setTimeout(() => {
          if (stateRef.current) {
            stateRef.current.fired = true;
            onLongPress?.(target);
          }
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove(e) {
      const s = stateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_TOLERANCE) clear();
    },
    onPointerUp(e) {
      const s = stateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const fired = s.fired;
      clear();
      if (!fired) onTap?.();
    },
    onPointerCancel() {
      clear();
    },
    onContextMenu(e) {
      e.preventDefault(); // hindra mobilens egen långtrycksmeny
    },
  };
}

import { useRef, useState } from 'react';

/*
 * Bandet: halvtransparent pastellrosa markering som dras med fingret.
 * Positionen lagras som andel (0–1) av sidans höjd/bredd i DOKUMENT-
 * koordinater, så att bandet sitter kvar på rätt rad vid zoom (§7.2).
 */
export const BAND_COLOR = '244, 194, 219';

export default function BandOverlay({
  orientation, // 'horisontell' | 'vertikal'
  position, // 0–1, andel av sidhöjd (horisontell) eller sidbredd (vertikal)
  thicknessCss, // bandets tjocklek i CSS-pixlar vid aktuell zoom
  opacity,
  pageCssWidth,
  pageCssHeight,
  onDragEnd, // (position) => void
}) {
  const [dragPos, setDragPos] = useState(null);
  const dragRef = useRef(null);

  const pos = dragPos ?? position;
  const horizontal = orientation === 'horisontell';

  function handlePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pekaren kan redan vara borta */
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPos: pos,
      latest: null,
    };
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const delta = horizontal
      ? (e.clientY - drag.startY) / pageCssHeight
      : (e.clientX - drag.startX) / pageCssWidth;
    // latest hålls i ref:en — state kan ligga en render efter vid släpp
    drag.latest = clamp01(drag.startPos + delta);
    setDragPos(drag.latest);
  }

  function handlePointerUp(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragRef.current = null;
    if (drag.latest != null) onDragEnd(drag.latest);
    setDragPos(null);
  }

  const style = horizontal
    ? {
        top: `${pos * pageCssHeight - thicknessCss / 2}px`,
        left: 0,
        width: '100%',
        height: `${thicknessCss}px`,
      }
    : {
        left: `${pos * pageCssWidth - thicknessCss / 2}px`,
        top: 0,
        height: '100%',
        width: `${thicknessCss}px`,
      };

  return (
    <div
      className={`band-overlay ${horizontal ? 'band-h' : 'band-v'} ${dragPos != null ? 'band-dragging' : ''}`}
      style={{ ...style, background: `rgba(${BAND_COLOR}, ${opacity})` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label="Markeringsband"
      aria-valuenow={Math.round(pos * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="band-handle" aria-hidden="true" />
    </div>
  );
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

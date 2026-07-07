import { useRef, useState } from 'react';

/*
 * Bandet: halvtransparent pastellrosa markering som dras med fingret.
 * Positionen lagras som andel (0–1) av sidans höjd/bredd i DOKUMENT-
 * koordinater, så att bandet sitter kvar på rätt rad vid zoom (§7.2).
 * Komponenten ritar ett band; i riktningen 'båda' monterar PdfViewer
 * två stycken (ett horisontellt + ett vertikalt) ovanpå varandra.
 *
 * Tjockleken justeras i inpassningsläget (D6) via verktygsraden — inte
 * här. I det läget (fitting) får bandet skarpare kantlinjer så att man
 * ser exakt vilka kanter man passar mot diagramraden.
 */
export const BAND_COLOR = '244, 194, 219';

export default function BandOverlay({
  orientation, // 'horisontell' | 'vertikal'
  position, // 0–1, andel av sidhöjd (horisontell) eller sidbredd (vertikal)
  thicknessCss, // bandets tjocklek i CSS-pixlar vid aktuell zoom
  opacity,
  pageCssWidth,
  pageCssHeight,
  fitting = false, // inpassningsläget aktivt
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

  function handleKeyDown(e) {
    const step = e.shiftKey ? 0.05 : 0.01;
    let next = null;
    if (horizontal) {
      if (e.key === 'ArrowDown') next = clamp01(pos + step);
      if (e.key === 'ArrowUp') next = clamp01(pos - step);
    } else {
      if (e.key === 'ArrowRight') next = clamp01(pos + step);
      if (e.key === 'ArrowLeft') next = clamp01(pos - step);
    }
    if (next != null) {
      e.preventDefault();
      onDragEnd(next);
    }
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
      className={`band-overlay ${horizontal ? 'band-h' : 'band-v'} ${
        dragPos != null ? 'band-dragging' : ''
      } ${fitting ? 'band-fitting' : ''}`}
      style={{ ...style, background: `rgba(${BAND_COLOR}, ${opacity})` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label={horizontal ? 'Horisontellt markeringsband' : 'Vertikalt markeringsband'}
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

import { useRef, useState } from 'react';

/*
 * Bandet: halvtransparent pastellrosa markering som dras med fingret.
 * Positionen lagras som andel (0–1) av sidans höjd/bredd i DOKUMENT-
 * koordinater, så att bandet sitter kvar på rätt rad vid zoom (§7.2).
 *
 * Tjockleken justeras direkt i vyn (D6): greppet på bandets kant dras
 * tills bandet täcker exakt en diagramrad — motsatta kanten ligger
 * still, så man lägger den mot radens ena sida genom att flytta bandet
 * och drar sedan kanten till den andra. Anroparen sparar resultatet
 * per projekt.
 */
export const BAND_COLOR = '244, 194, 219';

export default function BandOverlay({
  orientation, // 'horisontell' | 'vertikal'
  position, // 0–1, andel av sidhöjd (horisontell) eller sidbredd (vertikal)
  thicknessCss, // bandets tjocklek i CSS-pixlar vid aktuell zoom
  thicknessPt, // samma tjocklek i PDF-punkter — för uppläsning och tangentbord
  minThicknessCss,
  maxThicknessCss,
  opacity,
  pageCssWidth,
  pageCssHeight,
  onDragEnd, // (position) => void
  onResizeEnd, // (position, thicknessCss) => void
}) {
  const [dragPos, setDragPos] = useState(null);
  const [resizePreview, setResizePreview] = useState(null); // { pos, thick }
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const pos = resizePreview?.pos ?? dragPos ?? position;
  const thick = resizePreview?.thick ?? thicknessCss;
  const horizontal = orientation === 'horisontell';
  const pageSpan = horizontal ? pageCssHeight : pageCssWidth;

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

  // ---------- Tjockleksgreppet (D6) ----------

  /** Motsatta kanten ligger still: nya kanten följer fingret, mitten räknas om. */
  function resizeTo(fixedEdgeCss, movingEdgeCss) {
    const newThick = clamp(movingEdgeCss - fixedEdgeCss, minThicknessCss, maxThicknessCss);
    const newPos = clamp01((fixedEdgeCss + newThick / 2) / pageSpan);
    return { pos: newPos, thick: newThick };
  }

  function handleResizeDown(e) {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pekaren kan redan vara borta */
    }
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      fixedEdge: pos * pageSpan - thick / 2, // övre/vänstra kanten står still
      startEdge: pos * pageSpan + thick / 2,
      latest: null,
    };
  }

  function handleResizeMove(e) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const delta = horizontal ? e.clientY - resize.startY : e.clientX - resize.startX;
    resize.latest = resizeTo(resize.fixedEdge, resize.startEdge + delta);
    setResizePreview(resize.latest);
  }

  function handleResizeUp(e) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    e.stopPropagation();
    resizeRef.current = null;
    if (resize.latest != null) onResizeEnd(resize.latest.pos, resize.latest.thick);
    setResizePreview(null);
  }

  function handleResizeKeyDown(e) {
    // 2 pt per steg — samma upplösning som reglaget i Inställningar
    const stepCss = 2 * (thicknessCss / thicknessPt);
    const grow = horizontal ? e.key === 'ArrowDown' : e.key === 'ArrowRight';
    const shrink = horizontal ? e.key === 'ArrowUp' : e.key === 'ArrowLeft';
    if (!grow && !shrink) return;
    e.preventDefault();
    e.stopPropagation();
    const fixedEdge = pos * pageSpan - thick / 2;
    const movingEdge = pos * pageSpan + thick / 2 + (grow ? stepCss : -stepCss);
    const next = resizeTo(fixedEdge, movingEdge);
    onResizeEnd(next.pos, next.thick);
  }

  const style = horizontal
    ? {
        top: `${pos * pageCssHeight - thick / 2}px`,
        left: 0,
        width: '100%',
        height: `${thick}px`,
      }
    : {
        left: `${pos * pageCssWidth - thick / 2}px`,
        top: 0,
        height: '100%',
        width: `${thick}px`,
      };

  return (
    <div
      className={`band-overlay ${horizontal ? 'band-h' : 'band-v'} ${
        dragPos != null || resizePreview != null ? 'band-dragging' : ''
      }`}
      style={{ ...style, background: `rgba(${BAND_COLOR}, ${opacity})` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="Markeringsband"
      aria-valuenow={Math.round(pos * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="band-handle" aria-hidden="true" />
      {onResizeEnd && (
        <div
          className="band-resize"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onPointerCancel={handleResizeUp}
          onKeyDown={handleResizeKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="Bandets tjocklek"
          aria-valuenow={Math.round(thicknessPt)}
          aria-valuetext={`${Math.round(thicknessPt)} punkter`}
          aria-valuemin={Math.round(minThicknessCss / (thicknessCss / thicknessPt))}
          aria-valuemax={Math.round(maxThicknessCss / (thicknessCss / thicknessPt))}
        >
          <div className="band-resize-grip" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

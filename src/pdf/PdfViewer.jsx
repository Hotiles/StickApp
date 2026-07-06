import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BandOverlay from './BandOverlay.jsx';

/*
 * Mönstervisaren: pdf.js-canvas med pinch-zoom, panorering, sidbläddring
 * (knappar + svep) och bandet som overlay i dokumentkoordinater.
 *
 * zoom = 1 betyder "sidan fyller skärmens bredd". Canvasen ritas om i skarp
 * upplösning när zoomen stannat (och CSS-skalas under själva gesten).
 */

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;
const MAX_CANVAS_PIXELS = 12_000_000; // säkerhetsmarginal för iOS-canvasgränser
const MAX_CANVAS_DIM = 4096;
const SWIPE_MIN_DX = 64;
const DEFAULT_BAND_POSITION = 0.25;

export default function PdfViewer({
  doc,
  initialViewState,
  bandOpacity = 0.4,
  bandThickness = 24, // i PDF-punkter
  showBandControls = true,
  onStateChange, // (viewState) => void — anroparen sköter debounce/persistens
}) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);

  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  const [pageNum, setPageNum] = useState(() => clampPage(initialViewState?.page ?? 1, doc));
  const [pageInfo, setPageInfo] = useState(null); // { page, widthPt, heightPt }
  const [zoom, setZoom] = useState(initialViewState?.zoom ?? 1);
  const [scroll, setScroll] = useState({
    x: initialViewState?.scrollX ?? 0,
    y: initialViewState?.scrollY ?? 0,
  });
  const [settledZoom, setSettledZoom] = useState(initialViewState?.zoom ?? 1);
  const [band, setBand] = useState(
    () =>
      initialViewState?.band ?? {
        orientation: 'horisontell',
        positionByPage: {},
        visible: true,
      }
  );
  const [renderError, setRenderError] = useState(null);

  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const lastTapRef = useRef(null);
  const renderTaskRef = useRef(null);
  const scrollRestoredRef = useRef(false);

  // ---------- Rapportera state uppåt ----------
  const reportState = useCallback(
    (next = {}) => {
      if (!onStateChange) return;
      onStateChange({
        page: next.page ?? pageNumRef.current,
        zoom: next.zoom ?? zoomRef.current,
        scrollX: next.scrollX ?? scrollRef.current.x,
        scrollY: next.scrollY ?? scrollRef.current.y,
        band: next.band ?? bandRef.current,
      });
    },
    [onStateChange]
  );

  // Refs som speglar state så att reportState alltid ser färska värden
  const pageNumRef = useRef(pageNum);
  const zoomRef = useRef(zoom);
  const scrollRef = useRef(scroll);
  const bandRef = useRef(band);
  pageNumRef.current = pageNum;
  zoomRef.current = zoom;
  scrollRef.current = scroll;
  bandRef.current = band;

  // ---------- Viewportstorlek ----------
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setViewportSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ---------- Ladda aktuell sida ----------
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    doc
      .getPage(pageNum)
      .then((page) => {
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1 });
        setPageInfo({ page, widthPt: vp.width, heightPt: vp.height });
        // Värm upp grannsidorna så bläddring känns snabb
        if (pageNum + 1 <= doc.numPages) doc.getPage(pageNum + 1).catch(() => {});
        if (pageNum - 1 >= 1) doc.getPage(pageNum - 1).catch(() => {});
      })
      .catch((err) => !cancelled && setRenderError(err));
    return () => {
      cancelled = true;
    };
  }, [doc, pageNum]);

  // Sidans CSS-storlek vid zoom = 1 (fyller viewportens bredd)
  const baseCss = useMemo(() => {
    if (!pageInfo || !viewportSize.w) return null;
    const w = viewportSize.w;
    return { w, h: (w * pageInfo.heightPt) / pageInfo.widthPt };
  }, [pageInfo, viewportSize.w]);

  const clampOffsets = useCallback(
    (z, sx, sy) => {
      if (!baseCss) return { x: sx, y: sy };
      const w = baseCss.w * z;
      const h = baseCss.h * z;
      const { w: vw, h: vh } = viewportSize;
      const x = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, sx));
      const y = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, sy));
      return { x, y };
    },
    [baseCss, viewportSize]
  );

  // Återställ sparad scrollposition första gången sidan fått mått,
  // och håll offsets inom gränserna när storlekar ändras.
  useEffect(() => {
    if (!baseCss) return;
    if (!scrollRestoredRef.current) {
      scrollRestoredRef.current = true;
      setScroll(clampOffsets(zoomRef.current, scrollRef.current.x, scrollRef.current.y));
    } else {
      setScroll((s) => clampOffsets(zoomRef.current, s.x, s.y));
    }
  }, [baseCss, viewportSize, clampOffsets]);

  // ---------- Skarp omritning när zoomen stannat ----------
  useEffect(() => {
    const t = setTimeout(() => setSettledZoom(zoom), 300);
    return () => clearTimeout(t);
  }, [zoom]);

  useEffect(() => {
    if (!pageInfo || !baseCss || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let scale = (baseCss.w * settledZoom * dpr) / pageInfo.widthPt;
    const pxW = pageInfo.widthPt * scale;
    const pxH = pageInfo.heightPt * scale;
    const factor = Math.min(
      1,
      Math.sqrt(MAX_CANVAS_PIXELS / (pxW * pxH)),
      MAX_CANVAS_DIM / pxW,
      MAX_CANVAS_DIM / pxH
    );
    scale *= factor;

    const viewport = pageInfo.page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    if (renderTaskRef.current) renderTaskRef.current.cancel();
    const ctx = canvas.getContext('2d');
    const task = pageInfo.page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    task.promise
      .then(() => {
        renderTaskRef.current = null;
        setRenderError(null);
      })
      .catch((err) => {
        if (err?.name !== 'RenderingCancelledException') setRenderError(err);
      });

    return () => {
      if (renderTaskRef.current === task) {
        task.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pageInfo, baseCss?.w, settledZoom]);

  // ---------- Sidbläddring ----------
  const goToPage = useCallback(
    (next) => {
      const clamped = clampPage(next, doc);
      if (clamped === pageNumRef.current) return;
      setPageNum(clamped);
      const resetScroll = clampOffsets(zoomRef.current, 0, 0);
      setScroll(resetScroll);
      reportState({ page: clamped, scrollX: resetScroll.x, scrollY: resetScroll.y });
    },
    [doc, clampOffsets, reportState]
  );

  // ---------- Gester (pan, pinch, svep, dubbeltryck) ----------
  function handlePointerDown(e) {
    const el = viewportRef.current;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* pekaren kan redan vara borta */
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = [...pointersRef.current.values()];

    if (pointers.length === 1) {
      gestureRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startScroll: { ...scrollRef.current },
        totalDx: 0,
        totalDy: 0,
      };
    } else if (pointers.length === 2) {
      const [a, b] = pointers;
      gestureRef.current = {
        type: 'pinch',
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startZoom: zoomRef.current,
        startScroll: { ...scrollRef.current },
        startMid: midpoint(a, b, viewportRef.current),
      };
    }
  }

  function handlePointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.type === 'pan' && pointersRef.current.size === 1) {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      gesture.totalDx = dx;
      gesture.totalDy = dy;
      setScroll(clampOffsets(zoomRef.current, gesture.startScroll.x + dx, gesture.startScroll.y + dy));
    } else if (gesture.type === 'pinch' && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.startDist < 10) return;
      const newZoom = clamp(gesture.startZoom * (dist / gesture.startDist), MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / gesture.startZoom;
      const mid = gesture.startMid;
      const sx = mid.x - (mid.x - gesture.startScroll.x) * ratio;
      const sy = mid.y - (mid.y - gesture.startScroll.y) * ratio;
      setZoom(newZoom);
      setScroll(clampOffsets(newZoom, sx, sy));
    }
  }

  function handlePointerUp(e) {
    pointersRef.current.delete(e.pointerId);
    const gesture = gestureRef.current;

    if (pointersRef.current.size === 0) {
      if (gesture?.type === 'pan') {
        const { totalDx, totalDy } = gesture;
        const moved = Math.hypot(totalDx, totalDy);

        // Svep byter sida när sidan fyller bredden (ingen horisontell pan möjlig)
        if (
          zoomRef.current <= 1.02 &&
          Math.abs(totalDx) > SWIPE_MIN_DX &&
          Math.abs(totalDx) > Math.abs(totalDy) * 1.5
        ) {
          goToPage(pageNumRef.current + (totalDx < 0 ? 1 : -1));
          gestureRef.current = null;
          return;
        }

        // Dubbeltryck: växla mellan översikt och inzoomat
        if (moved < 12 && e.pointerType !== 'mouse') {
          const nowTs = Date.now();
          const last = lastTapRef.current;
          if (last && nowTs - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40) {
            lastTapRef.current = null;
            toggleZoomAt(e.clientX, e.clientY);
          } else {
            lastTapRef.current = { t: nowTs, x: e.clientX, y: e.clientY };
          }
        }
      }
      gestureRef.current = null;
      reportState();
    } else if (pointersRef.current.size === 1) {
      // Från pinch till pan: starta om pan-gest med kvarvarande finger
      const [remaining] = [...pointersRef.current.values()];
      gestureRef.current = {
        type: 'pan',
        startX: remaining.x,
        startY: remaining.y,
        startScroll: { ...scrollRef.current },
        totalDx: 0,
        totalDy: 0,
      };
    }
  }

  function toggleZoomAt(clientX, clientY) {
    const rect = viewportRef.current.getBoundingClientRect();
    const mid = { x: clientX - rect.left, y: clientY - rect.top };
    const current = zoomRef.current;
    const target = current > 1.4 ? 1 : 2.5;
    const ratio = target / current;
    const sx = mid.x - (mid.x - scrollRef.current.x) * ratio;
    const sy = mid.y - (mid.y - scrollRef.current.y) * ratio;
    const clamped = clampOffsets(target, sx, sy);
    setZoom(target);
    setScroll(clamped);
    reportState({ zoom: target, scrollX: clamped.x, scrollY: clamped.y });
  }

  function handleDoubleClick(e) {
    toggleZoomAt(e.clientX, e.clientY);
  }

  // Wheel kopplas manuellt med { passive: false } — React registrerar wheel
  // passivt, vilket gör preventDefault verkningslöst (webbläsaren skulle
  // annars zooma hela sidan vid ctrl+scroll).
  const handleWheelRef = useRef(null);
  handleWheelRef.current = handleWheel;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const listener = (e) => handleWheelRef.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, []);

  function handleWheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = viewportRef.current.getBoundingClientRect();
      const mid = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const newZoom = clamp(zoomRef.current * (e.deltaY < 0 ? 1.1 : 0.9), MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / zoomRef.current;
      const sx = mid.x - (mid.x - scrollRef.current.x) * ratio;
      const sy = mid.y - (mid.y - scrollRef.current.y) * ratio;
      const clamped = clampOffsets(newZoom, sx, sy);
      setZoom(newZoom);
      setScroll(clamped);
      reportState({ zoom: newZoom, scrollX: clamped.x, scrollY: clamped.y });
    } else {
      const clamped = clampOffsets(zoomRef.current, scrollRef.current.x - e.deltaX, scrollRef.current.y - e.deltaY);
      setScroll(clamped);
      reportState({ scrollX: clamped.x, scrollY: clamped.y });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(pageNumRef.current + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(pageNumRef.current - 1);
  }

  // ---------- Bandet ----------
  const bandPosition = band.positionByPage[pageNum] ?? DEFAULT_BAND_POSITION;

  function updateBand(changes) {
    const next = { ...bandRef.current, ...changes };
    setBand(next);
    reportState({ band: next });
  }

  function handleBandDragEnd(position) {
    updateBand({
      positionByPage: { ...bandRef.current.positionByPage, [pageNumRef.current]: position },
    });
  }

  // ---------- Render ----------
  const numPages = doc?.numPages ?? 0;
  const pageCssW = baseCss ? baseCss.w * zoom : 0;
  const pageCssH = baseCss ? baseCss.h * zoom : 0;
  const cssPerPt = pageInfo && pageCssW ? pageCssW / pageInfo.widthPt : 1;

  return (
    <div className="pdf-container">
      <div
        className="pdf-viewport"
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={`Mönster, sida ${pageNum} av ${numPages}`}
      >
        {baseCss && (
          <div
            className="pdf-page"
            style={{
              width: `${pageCssW}px`,
              height: `${pageCssH}px`,
              transform: `translate(${scroll.x}px, ${scroll.y}px)`,
            }}
          >
            <canvas ref={canvasRef} className="pdf-canvas" />
            {band.visible && (
              <BandOverlay
                orientation={band.orientation}
                position={bandPosition}
                thicknessCss={bandThickness * cssPerPt}
                opacity={bandOpacity}
                pageCssWidth={pageCssW}
                pageCssHeight={pageCssH}
                onDragEnd={handleBandDragEnd}
              />
            )}
          </div>
        )}
        {!baseCss && !renderError && <div className="pdf-status">Laddar mönster …</div>}
        {renderError && (
          <div className="pdf-status pdf-error">Kunde inte visa sidan. Prova att öppna mönstret igen.</div>
        )}
      </div>

      <div className="pdf-toolbar">
        <button
          className="btn-icon"
          onClick={() => goToPage(pageNum - 1)}
          disabled={pageNum <= 1}
          aria-label="Föregående sida"
        >
          ‹
        </button>
        <span className="pdf-pageinfo">
          {pageNum} / {numPages || '–'}
        </span>
        <button
          className="btn-icon"
          onClick={() => goToPage(pageNum + 1)}
          disabled={pageNum >= numPages}
          aria-label="Nästa sida"
        >
          ›
        </button>
        {showBandControls && (
          <>
            <span className="pdf-toolbar-spacer" />
            <button
              className={`btn-icon ${band.visible ? 'btn-icon-active' : ''}`}
              onClick={() => updateBand({ visible: !band.visible })}
              aria-label={band.visible ? 'Dölj bandet' : 'Visa bandet'}
              title={band.visible ? 'Dölj bandet' : 'Visa bandet'}
            >
              <BandIcon />
            </button>
            {band.visible && (
              <button
                className="btn-icon"
                onClick={() =>
                  updateBand({
                    orientation: band.orientation === 'horisontell' ? 'vertikal' : 'horisontell',
                  })
                }
                aria-label="Växla bandets riktning"
                title="Växla bandets riktning"
              >
                {band.orientation === 'horisontell' ? '↕' : '↔'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="8" width="16" height="5" rx="2" fill="rgba(244,194,219,0.9)" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function clampPage(page, doc) {
  const max = doc?.numPages ?? 1;
  return Math.min(Math.max(1, page || 1), max);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function midpoint(a, b, el) {
  const rect = el.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
}
